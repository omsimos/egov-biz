import { createMCPClient } from "@ai-sdk/mcp";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import {
  BnrsError,
  mapEgovSsoProfileToBnrsResidentialAddress,
  type BnrsCertificate,
  type BnrsBusinessAddressInput,
} from "@repo/dx/bnrs";
import {
  convertToModelMessages,
  createGateway,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isToolUIPart,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import { generateBirFormInputSchema } from "@repo/dx/bir";
import { LguError, type LguApplicationStatus, type LguIssuedDocuments } from "@repo/dx/lgu";
import { fallbackQuestionFor, inferCategory } from "@/lib/business-rules";
import {
  buildRationale,
  citationsForPlan,
  locationQuestion,
  resolveBusinessLocation,
  selectRdo,
} from "@/lib/government-data";
import {
  planProgress,
  uniqueMessagesById,
  type BusinessChatMessage,
  type DtiBusinessNameForm,
  type LguPermitSummary,
  type PaymentServiceType,
  type RegistrationPlan,
  type UserInfoOutput,
} from "@/lib/business-chat";
import { readSession } from "@/lib/auth/session";
import { createBirFormArtifact } from "@/lib/bir-form/artifact";
import {
  completeRegistrationPlan,
  initialRegistrationPlan,
  normalizeRegistrationPlan,
} from "@/lib/registration-plan";
import type { CitizenProfile } from "@/lib/citizen-profile";
import {
  availableUserInfoFields,
  profileAddressPreference,
  shouldCollectStructuredBusinessAddress,
} from "@/lib/form-prefill";
import {
  extractExplicitSmsMessage,
  hasTaxObligationReference,
  isExplicitSmsSendRequest,
  isTaxPaymentReminderRetryRequest,
  isTaxPaymentReminderSimulationRequest,
  normalizeSmsNumber,
  resolveSmsRecipient,
  selectTaxReminderObligation,
  sendSmsMessage,
  sendSmsMessageInputSchema,
  simulateTaxPaymentReminder,
  simulateTaxPaymentReminderInputSchema,
  smsNumberMention,
  type SimulateTaxPaymentReminderInput,
} from "@/lib/emessage";
import type { BusinessPlan, IntakeAnswer, IntakeQuestion } from "@/lib/questions";
import { isValidChoiceAnswer } from "@/lib/intake-validation";
import { describesBusinessIdea, isRegistrationStart } from "@/lib/registration-intent";
import {
  businessManagementContext,
  deterministicBusinessManagementResponse,
} from "@/lib/business-management";
import type { RegisteredBusiness } from "@/lib/registered-business";
import { getBusiness } from "@/server/businesses";
import {
  getBnrsConversationLink,
  getConversation,
  saveMessages,
  setActiveStream,
} from "@/server/conversations";
import { BirDstPaymentError, syncBirDstPaymentForConversation } from "@/server/bir-dst-payment";
import { isPaidStatus, type StoredPayment } from "@/server/payments";
import {
  finalizeBirSelfEmployedRegistration,
  finalizeBirSoleProprietorRegistration,
} from "@/server/dx/bir-registrations";
import { bnrsActorFromProfile, getBnrs } from "@/server/dx/bnrs";
import {
  getBnrsCertificateForConversation,
  prepareBnrsApplication,
  syncBnrsPaymentForConversation,
} from "@/server/dx/bnrs-applications";
import {
  getLguDocumentsForConversation,
  getLguStatusForConversation,
  prepareLguApplication,
  syncLguPaymentForConversation,
} from "@/server/dx/lgu-applications";
import { getResumableContext } from "@/server/resumable";
import {
  dispatchSmsOnce,
  SmsDispatchRateLimitError,
  SmsDispatchUncertainError,
  type SmsDispatchKey,
} from "@/server/sms-dispatches";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function readBnrsCatalog() {
  const bnrs = getBnrs();
  return {
    nameRequirements: bnrs.getBusinessNameRequirements(),
    scopes: bnrs.getBusinessScopes(),
    termsAndConditions: bnrs.getTermsAndConditions(),
  };
}

type BnrsCatalog = ReturnType<typeof readBnrsCatalog>;

function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function lguPermitSummary(
  status: LguApplicationStatus,
  documents: LguIssuedDocuments | null = status.issuedDocuments,
): LguPermitSummary {
  return {
    applicationId: status.applicationId,
    state:
      status.state === "COMPLETED"
        ? "COMPLETED"
        : status.state === "PAYMENT_PENDING"
          ? "PAYMENT_PENDING"
          : "PAYMENT_READY",
    businessName: status.certificate.businessName,
    city: status.city,
    feeLabel: formatPeso(status.fee.totalFee),
    paymentStatus:
      status.payment?.status === "PAID"
        ? "PAID"
        : status.payment?.status === "PENDING" || status.payment?.status === "CREATING"
          ? "PENDING"
          : null,
    businessPermitNumber: documents?.businessPermit.permitNumber ?? null,
    barangayClearanceNumber: documents?.barangayClearance.clearanceNumber ?? null,
    validUntil: documents?.businessPermit.validUntil ?? null,
  };
}

const PLACEHOLDER_ANSWER =
  /^(?:a+s+s+|asdf+|test(?:ing)?|sample|placeholder|none|n\/?a|not sure|unknown|idk|tbd|xxx+|-+)$/i;

function normalizedAnswerText(value: string | string[]) {
  return (Array.isArray(value) ? value.join(" ") : value).trim().replace(/\s+/g, " ");
}

function hasCompletedTool(messages: UIMessage[], type: string) {
  return messages.some((message) =>
    message.parts.some(
      (part) => isToolUIPart(part) && part.type === type && part.state === "output-available",
    ),
  );
}

function isMeaningfulBusinessName(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= 3 && /[a-z\d]/i.test(text) && !PLACEHOLDER_ANSWER.test(text);
}

function isCompleteBusinessAddress(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 10 || PLACEHOLDER_ANSWER.test(text)) return false;
  const addressMarker =
    /\b(?:\d{1,5}|unit|room|floor|block|lot|house|street|st\.?|road|rd\.?|avenue|ave\.?|drive|highway|building|bldg\.?|plaza|village|subdivision|purok|sitio|poblacion|barangay|brgy\.?)\b/i.test(
      text,
    );
  return addressMarker && (text.includes(",") || text.split(" ").length >= 4);
}

function isUsableIntakeAnswer(answer: IntakeAnswer, question?: IntakeQuestion) {
  if (answer.questionId === "bnrs-terms-accepted") return answer.value === "accept";
  if (question?.type === "single" || question?.type === "multi")
    return isValidChoiceAnswer(question, answer.value);
  const text = normalizedAnswerText(answer.value);
  if (!text || PLACEHOLDER_ANSWER.test(text)) return false;
  if (answer.questionId === "business-address") return isCompleteBusinessAddress(text);
  if (answer.questionId === "business-dominant-name") return isMeaningfulBusinessName(text);
  return true;
}

const optionSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(100),
  description: z.string().max(140).optional(),
  icon: z.enum(["store", "laptop", "coffee", "home", "pin", "calendar"]).optional(),
});
const questionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(60),
    eyebrow: z.string().min(1).max(30),
    title: z.string().min(1).max(120),
    helpText: z.string().max(2_000),
    type: z.enum(["single", "multi", "number", "text"]),
    options: z.array(optionSchema).max(40).optional(),
    allowOther: z.boolean().optional(),
    placeholder: z.string().max(100).optional(),
    suffix: z.string().max(30).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
  })
  .superRefine((question, context) => {
    if (
      (question.type === "single" || question.type === "multi") &&
      (!question.options || question.options.length < 2)
    )
      context.addIssue({
        code: "custom",
        message: "Choice questions need at least two options",
        path: ["options"],
      });
  });
function dtiFormSchema(catalog: BnrsCatalog) {
  const descriptorIds = new Set<string>(catalog.nameRequirements.descriptors.map(({ id }) => id));
  const scopeIds = new Set<string>(catalog.scopes.map(({ id }) => id));
  return z.object({
    applicationType: z.literal("New registration"),
    status: z.enum(["Ready to submit", "Submitted"]),
    dominantName: z
      .string()
      .trim()
      .refine(isMeaningfulBusinessName, "A dominant business name is required"),
    descriptorId: z.string().refine((id) => descriptorIds.has(id), "Select a BNRS descriptor"),
    businessActivity: z.string().trim().min(1),
    territorialScopeId: z
      .enum(["CITY_MUNICIPALITY", "REGIONAL", "NATIONAL"])
      .refine((id) => scopeIds.has(id), "Select a BNRS scope"),
    ownerName: z.string().trim().min(1),
    businessAddress: z
      .string()
      .trim()
      .refine(isCompleteBusinessAddress, "A complete business address is required"),
    city: z.string().trim().min(1),
    missingFields: z.array(z.string()).max(0),
  });
}
type EditDtiFormInput = {
  form: z.infer<ReturnType<typeof dtiFormSchema>>;
  note: string;
};
type EditDtiFormOutput = { applicationId: string; form: DtiBusinessNameForm };
const planStepSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  status: z.enum(["pending", "in_progress", "completed", "skipped"]),
  optional: z.boolean().optional(),
});
const registrationPlanSchema = z.object({
  title: z.string().min(1).max(120),
  steps: z.array(planStepSchema).min(2).max(12),
});
const paymentServiceSchema = z.enum([
  "dti-business-name",
  "lgu-business-permit",
  "bir-documentary-stamp-tax",
]);
const requestSchema = z.object({
  id: z.string().uuid(),
  messages: z.array(z.unknown()),
  initialPrompt: z.string().trim().min(1).max(2_000),
  event: z.enum(["payment-completed", "registration-completed"]).optional(),
  paymentService: paymentServiceSchema.optional(),
});
type GeneratedRoute = {
  businessLabel: string;
  registrationType: "Sole proprietor" | "Self-employed" | "Company" | "Needs review";
  category: BusinessPlan["category"];
  flags: BusinessPlan["flags"];
  setup: string[];
  people: number;
};

function userText(messages: UIMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .flatMap((message) =>
      message.parts.filter((part) => part.type === "text").map((part) => part.text),
    )
    .join("\n");
}

function profileAddressQuestion(): IntakeQuestion {
  return {
    id: "profile-address",
    eyebrow: "Business address",
    title: "Which address should this registration use?",
    helpText: "Choose your residential address from eGov SSO or enter a business address.",
    type: "single",
    allowOther: false,
    options: [
      {
        id: "use-profile-address",
        label: "Use my registered eGov address",
        description: "Prefill the verified address from my profile",
      },
      {
        id: "use-different-address",
        label: "Use a different address",
        description: "I will enter the business address",
      },
    ],
  };
}

function addressPreference(answers: IntakeAnswer[]) {
  return profileAddressPreference(
    answers.find((answer) => answer.questionId === "profile-address")?.value,
  );
}

function planAfterPermitIssued(plan: RegistrationPlan): RegistrationPlan {
  return normalizeRegistrationPlan({
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      status: [
        "details",
        "structure",
        "name-registration",
        "local-clearance",
        "business-permit",
      ].includes(step.id)
        ? "completed"
        : step.id === "bir"
          ? "in_progress"
          : "pending",
    })),
  });
}

function questionsForIncompleteDtiForm(
  form: DtiBusinessNameForm,
  answers: IntakeAnswer[],
  catalog: BnrsCatalog,
) {
  const answered = new Set(answers.map((answer) => answer.questionId));
  const questions: IntakeQuestion[] = [];
  if (!form.dominantName && !answered.has("business-dominant-name"))
    questions.push(dominantNameQuestion(catalog));
  if (!form.descriptorId && !answered.has("business-descriptor"))
    questions.push(descriptorQuestion(catalog));
  if (!form.territorialScopeId && !answered.has("business-territorial-scope"))
    questions.push(territorialScopeQuestion(catalog));
  if (!form.termsAccepted) questions.push(termsQuestion(catalog));
  if (!form.businessAddressDetails)
    questions.push(
      ...structuredAddressQuestions("Sole proprietor").filter(({ id }) => !answered.has(id)),
    );
  return questions;
}

function latestUserMessage(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.role !== "user") continue;
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) return { index, message, text };
  }
  return null;
}

function immediatelyFailedTaxReminderInput(
  messages: BusinessChatMessage[],
): SimulateTaxPaymentReminderInput | null {
  const latest = latestUserMessage(messages);
  if (!latest || latest.index === 0) return null;
  const previous = messages[latest.index - 1];
  if (previous?.role !== "assistant") return null;
  for (const part of [...previous.parts].reverse()) {
    if (
      !isToolUIPart(part) ||
      part.type !== "tool-simulate_tax_payment_reminder" ||
      part.state !== "output-error"
    )
      continue;
    const parsed = simulateTaxPaymentReminderInputSchema.safeParse(part.input);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function planAfterPayment(plan: RegistrationPlan | null): RegistrationPlan {
  const source = plan ?? initialRegistrationPlan;
  return normalizeRegistrationPlan({
    ...source,
    steps: source.steps.map((step) => ({
      ...step,
      status:
        step.id === "details" || step.id === "structure" || step.id === "name-registration"
          ? "completed"
          : step.id === "local-clearance"
            ? "in_progress"
            : "pending",
    })),
  });
}

function resumableConsumer(ownerEgovUserId: string, conversationId: string) {
  return async ({ stream }: { stream: ReadableStream<string> }) => {
    const streamId = crypto.randomUUID();
    await setActiveStream(ownerEgovUserId, conversationId, streamId);
    try {
      await getResumableContext().createNewResumableStream(streamId, () => stream);
    } catch (error) {
      await setActiveStream(ownerEgovUserId, conversationId, null);
      console.error("Business chat resumable stream failed", error);
    }
  };
}

function manualResponse(
  ownerEgovUserId: string,
  conversationId: string,
  messages: BusinessChatMessage[],
  execute: (writer: UIMessageStreamWriter<BusinessChatMessage>) => Promise<void> | void,
  options: { resumable?: boolean } = {},
) {
  const stream = createUIMessageStream<BusinessChatMessage>({
    originalMessages: messages,
    execute: ({ writer }) => execute(writer),
    onEnd: async ({ messages: completeMessages }) => {
      await saveMessages(ownerEgovUserId, conversationId, completeMessages);
      await setActiveStream(ownerEgovUserId, conversationId, null);
    },
  });
  return createUIMessageStreamResponse({
    stream,
    ...(options.resumable === false
      ? {}
      : { consumeSseStream: resumableConsumer(ownerEgovUserId, conversationId) }),
  });
}

async function managementResponse(
  ownerEgovUserId: string,
  conversationId: string,
  business: RegisteredBusiness,
  messages: BusinessChatMessage[],
  profileId: string,
  profileMobile: string,
) {
  const latestUser = latestUserMessage(messages);
  const latestPrompt = latestUser?.text ?? "";
  if (!process.env.AI_GATEWAY_API_KEY)
    return manualResponse(
      ownerEgovUserId,
      conversationId,
      messages,
      (writer) => {
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: deterministicBusinessManagementResponse(business, latestPrompt),
        });
        writer.write({ type: "text-end", id: textId });
      },
      { resumable: false },
    );

  const model = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY }).chat(
    process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite",
  );
  const obligation = business.taxObligations[0];
  const tools = emessageTools({
    profileMobile,
    latestPrompt,
    allowTaxReminderRetry: Boolean(immediatelyFailedTaxReminderInput(messages)),
    dispatchKey: {
      actorId: profileId,
      conversationId,
      userMessageId: latestUser?.message.id ?? conversationId,
    },
    reminderDefaults: {
      businessName: business.name,
      ...(obligation?.title ? { taxTitle: obligation.title } : {}),
      ...(obligation?.formCode ? { formCode: obligation.formCode } : {}),
      ...(obligation?.dueDate ? { dueDate: obligation.dueDate } : {}),
    },
  });
  const responseMessageId = crypto.randomUUID();
  const result = streamText({
    model,
    tools,
    activeTools: ["send_sms_message", "simulate_tax_payment_reminder"],
    stopWhen: stepCountIs(3),
    system: `You are the post-registration business assistant for one Filipino business. Answer concisely and warmly using the saved business record below. Help with the tax calendar, saved files, registrations, permits, renewals, employer obligations, and remaining operational compliance.

Treat the record as the only source of truth about this business. Never start or continue a new-business registration workflow. Never invent a filing, status, deadline, reference number, document, or completed government action. Say clearly when the record does not contain an answer. Records come from the BNRS, LGU, and BIR DX modules; distinguish that sandbox service state from actions the citizen must confirm with BIR, the LGU, BFP, or another responsible agency. Prefer short paragraphs and lists; use a table only when comparing three or more records.

Use send_sms_message only when the citizen explicitly asks to send an SMS. Pass a recipient number only when the citizen supplied one in chat; otherwise omit it so the authenticated eGov SSO number is used. Use simulate_tax_payment_reminder only when the citizen explicitly asks to simulate sending a tax payment reminder. Never send a reminder for an ordinary question about tax dates or obligations.

Saved business record:
${JSON.stringify(businessManagementContext(business))}`,
    messages: await convertToModelMessages(messages, {
      tools,
      ignoreIncompleteToolCalls: true,
    }),
    timeout: { totalMs: 110_000 },
  });
  // Consume an independent UI stream so tool parts and text are persisted even
  // if the user navigates away from the client-facing stream.
  void result
    .toUIMessageStream<BusinessChatMessage>({
      originalMessages: messages,
      generateMessageId: () => responseMessageId,
      sendReasoning: false,
      onEnd: async ({ messages: completeMessages }) => {
        await saveMessages(ownerEgovUserId, conversationId, completeMessages);
        await setActiveStream(ownerEgovUserId, conversationId, null);
      },
    })
    .pipeTo(new WritableStream())
    .catch((error) => console.error("Business management response persistence failed", error));
  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream<BusinessChatMessage>({
      originalMessages: messages,
      generateMessageId: () => responseMessageId,
      sendReasoning: false,
    }),
  });
}

function dominantNameQuestion(catalog: BnrsCatalog): IntakeQuestion {
  return {
    id: "business-dominant-name",
    eyebrow: "Business identity",
    title: "What distinctive name do you want to register?",
    helpText: `Enter only the dominant name; choose the business descriptor separately. ${catalog.nameRequirements.reminders[4]}`,
    type: "text",
    placeholder: "For example, Molar Bear",
  };
}

function descriptorQuestion(catalog: BnrsCatalog): IntakeQuestion {
  return {
    id: "business-descriptor",
    eyebrow: "Business identity",
    title: "Which BNRS descriptor best matches the business?",
    helpText: "Choose an official descriptor. It will be kept separate from the dominant name.",
    type: "single",
    allowOther: false,
    options: catalog.nameRequirements.descriptors.map(({ id, label }) => ({ id, label })),
  };
}

function territorialScopeQuestion(catalog: BnrsCatalog): IntakeQuestion {
  return {
    id: "business-territorial-scope",
    eyebrow: "Registration scope",
    title: "Where should the business name be protected?",
    helpText: "Each total includes the documentary stamp tax.",
    type: "single",
    allowOther: false,
    options: catalog.scopes.map((scope) => ({
      id: scope.id,
      label: scope.label === "City/Municipality" ? "City / municipality" : scope.label,
      description: `${formatPeso(scope.totalFee)} total`,
    })),
  };
}

function termsQuestion(catalog: BnrsCatalog): IntakeQuestion {
  return {
    id: "bnrs-terms-accepted",
    eyebrow: "BNRS terms",
    title: "Do you accept the BNRS terms and conditions?",
    helpText: catalog.termsAndConditions,
    type: "single",
    allowOther: false,
    options: [
      { id: "accept", label: "I accept", description: "Continue the BNRS application" },
      { id: "decline", label: "I do not accept", description: "Do not create the application" },
    ],
  };
}

function structuredAddressQuestions(
  registrationType: BusinessPlan["registrationType"],
): IntakeQuestion[] {
  return [
    {
      id: "business-address-line-1",
      eyebrow: "Business address",
      title: "What is the street, building, or unit for the business?",
      helpText: "Enter address line 1 only.",
      type: "text",
      placeholder: "Unit, building, street",
    },
    {
      id: "business-barangay",
      eyebrow: "Business address",
      title: "What barangay is the business in?",
      helpText: "Enter the official barangay name.",
      type: "text",
      placeholder: "Barangay",
    },
    {
      id: "business-city-municipality",
      eyebrow: "Business address",
      title: "What city or municipality is the business in?",
      helpText: "Enter the official city or municipality name.",
      type: "text",
      placeholder: "City or municipality",
    },
    {
      id: "business-province",
      eyebrow: "Business address",
      title: "What province is the business in?",
      helpText: "For Metro Manila addresses, enter Metro Manila.",
      type: "text",
      placeholder: "Province",
    },
    {
      id: "business-region",
      eyebrow: "Business address",
      title: "What region is the business in?",
      helpText: "Enter the official region name.",
      type: "text",
      placeholder: "Region",
    },
    {
      id: "business-postal-code",
      eyebrow: "Business address",
      title: "What is the four-digit postal code?",
      helpText:
        registrationType === "Self-employed"
          ? "Enter the postal code for the work address."
          : "BNRS requires a complete postal code.",
      type: "text",
      placeholder: "1234",
    },
  ];
}

function promptHasWorkSetup(prompt: string) {
  return /\b(home[- ]based|from home|at home|online|remote(?:ly)?|virtual|storefront|shop|office|clinic|commercial (?:space|unit|kitchen)|physical (?:shop|location|premises))\b/i.test(
    prompt,
  );
}

function promptHasStaffing(prompt: string) {
  return /\b(no employees?|without employees?|work alone|working alone|just me|by myself|solo|hire|hiring|employees?|staff|workers?|team of \d+|\d+ (?:employees?|staff|workers?|people))\b/i.test(
    prompt,
  );
}

function intakeBatch(
  prompt: string,
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
  catalog: BnrsCatalog,
  residentialAddress: BnrsBusinessAddressInput | null,
) {
  const answered = new Set(answers.map((answer) => answer.questionId));
  const location = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const questions: IntakeQuestion[] = [];
  if (
    !selectRdo(location, answers, `${prompt} ${profile?.barangay ?? ""}`) &&
    location.rdos.length > 1
  )
    questions.push(locationQuestion(location.city, location.rdos));
  const activityQuestion = fallbackQuestionFor(prompt, 0);
  if (!answered.has(activityQuestion.id) && !promptHasWorkSetup(prompt))
    questions.push(activityQuestion);
  if (!answered.has("workers") && !promptHasStaffing(prompt))
    questions.push(fallbackQuestionFor(prompt, 1));
  const preference = addressPreference(answers);
  const registrationType = makePlan(prompt, profile, answers).registrationType;
  if (!preference) questions.push(profileAddressQuestion());
  else if (
    shouldCollectStructuredBusinessAddress(
      preference,
      registrationType,
      Boolean(residentialAddress),
    )
  )
    questions.push(
      ...structuredAddressQuestions(registrationType).filter(({ id }) => !answered.has(id)),
    );
  if (registrationType === "Sole proprietor") {
    if (!answered.has("bnrs-terms-accepted")) questions.push(termsQuestion(catalog));
    if (!answered.has("business-dominant-name")) questions.push(dominantNameQuestion(catalog));
    if (!answered.has("business-descriptor")) questions.push(descriptorQuestion(catalog));
    if (!answered.has("business-territorial-scope"))
      questions.push(territorialScopeQuestion(catalog));
  }
  return questions.slice(0, 6);
}

function toolAnswers(messages: UIMessage[]): IntakeAnswer[] {
  const answers = new Map<string, IntakeAnswer>();
  for (const message of messages)
    for (const part of message.parts) {
      if (part.type !== "tool-askUser" || part.state !== "output-available") continue;
      const input = part.input as {
        questions?: IntakeQuestion[];
        question?: IntakeQuestion;
      };
      const output = part.output as {
        answers?: {
          questionId: string;
          value: string | string[];
          labels: string[];
        }[];
        value?: string | string[];
        labels?: string[];
      };
      const questions = input.questions ?? (input.question ? [input.question] : []);
      const submitted =
        output.answers ??
        (questions[0] && output.value !== undefined
          ? [
              {
                questionId: questions[0].id,
                value: output.value,
                labels: output.labels ?? [],
              },
            ]
          : []);
      for (const answer of submitted) {
        const question = questions.find((item) => item.id === answer.questionId);
        if (!question) continue;
        const intakeAnswer = {
          toolCallId: part.toolCallId,
          questionId: question.id,
          question: question.title,
          value: answer.value,
          labels: answer.labels,
        };
        if (isUsableIntakeAnswer(intakeAnswer, question)) answers.set(question.id, intakeAnswer);
        else answers.delete(question.id);
      }
    }
  return [...answers.values()];
}

function invalidIntakeAnswerIds(messages: UIMessage[]) {
  const invalid = new Set<string>();
  for (const message of messages)
    for (const part of message.parts) {
      if (part.type !== "tool-askUser" || part.state !== "output-available") continue;
      const input = part.input as {
        questions?: IntakeQuestion[];
        question?: IntakeQuestion;
      };
      const output = part.output as {
        answers?: {
          questionId: string;
          value: string | string[];
          labels: string[];
        }[];
        value?: string | string[];
        labels?: string[];
      };
      const questions = input.questions ?? (input.question ? [input.question] : []);
      const submitted =
        output.answers ??
        (questions[0] && output.value !== undefined
          ? [
              {
                questionId: questions[0].id,
                value: output.value,
                labels: output.labels ?? [],
              },
            ]
          : []);
      for (const answer of submitted) {
        const question = questions.find((item) => item.id === answer.questionId);
        if (!question) continue;
        const intakeAnswer: IntakeAnswer = {
          toolCallId: part.toolCallId,
          questionId: question.id,
          question: question.title,
          value: answer.value,
          labels: answer.labels,
        };
        if (isUsableIntakeAnswer(intakeAnswer, question)) invalid.delete(question.id);
        else invalid.add(question.id);
      }
    }
  return invalid;
}

function lastRegistrationPlan(messages: UIMessage[]): RegistrationPlan | null {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (part.type === "tool-updatePlan" && part.state === "output-available")
        return (part.output as { plan: RegistrationPlan }).plan;
    }
  return null;
}

function emitTool(
  writer: Parameters<
    Parameters<typeof createUIMessageStream<BusinessChatMessage>>[0]["execute"]
  >[0]["writer"],
  toolName: string,
  input: unknown,
  output: unknown,
) {
  const toolCallId = crypto.randomUUID();
  writer.write({
    type: "tool-input-available",
    toolCallId,
    toolName,
    input,
  } as never);
  writer.write({ type: "tool-output-available", toolCallId, output } as never);
}

function planForBirPayment(
  plan: RegistrationPlan,
  registrationType: BusinessPlan["registrationType"],
) {
  return normalizeRegistrationPlan({
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      status:
        step.id === "bir"
          ? ("in_progress" as const)
          : registrationType === "Self-employed" &&
              ["name-registration", "local-clearance", "business-permit"].includes(step.id)
            ? ("skipped" as const)
            : ["details", "structure"].includes(step.id)
              ? ("completed" as const)
              : step.status,
    })),
  });
}

async function emitBir1901Generation(
  writer: UIMessageStreamWriter<BusinessChatMessage>,
  request: Request,
  rawProfile: EgovSsoCitizenProfile,
  conversationId: string,
  plan: RegistrationPlan,
) {
  const toolCallId = crypto.randomUUID();
  writer.write({
    type: "tool-input-available",
    toolCallId,
    toolName: "generate_bir_form",
    input: { type: "1901", data: {} },
  });

  try {
    const output = {
      artifact: await createBirFormArtifact(
        request,
        rawProfile,
        { type: "1901", data: {} },
        conversationId,
      ),
      source: "BIR tool input merged with authenticated eGov SSO profile" as const,
    };

    writer.write({ type: "tool-output-available", toolCallId, output });
    const generatedPlan = {
      ...plan,
      note: "BIR Form 1901 generated. Documentary stamp tax payment is the final required checkpoint.",
    };
    emitTool(writer, "updatePlan", generatedPlan, { plan: generatedPlan });
    const textId = crypto.randomUUID();
    writer.write({ type: "text-start", id: textId });
    writer.write({
      type: "text-delta",
      id: textId,
      delta:
        "Your DX-generated BIR Form 1901 is ready. Preview the PDF, then pay the ₱30 Documentary Stamp Tax below to complete this registration plan. Books and invoices, sector permits, and employer-agency registrations are optional follow-ups.",
    });
    writer.write({ type: "text-end", id: textId });
  } catch (error) {
    console.warn("BIR form artifact generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    writer.write({
      type: "tool-output-error",
      toolCallId,
      errorText: "The PDF could not be generated.",
    } as never);
    const textId = crypto.randomUUID();
    writer.write({ type: "text-start", id: textId });
    writer.write({
      type: "text-delta",
      id: textId,
      delta: "I couldn’t generate the BIR form PDF. No downstream registration was recorded.",
    });
    writer.write({ type: "text-end", id: textId });
  }
}

function planForAnswers(
  answers: IntakeAnswer[],
  hasSearched: boolean,
  hasForm: boolean,
  intakeReady?: boolean,
  registrationType?: BusinessPlan["registrationType"],
) {
  const answerIds = new Set(answers.map((answer) => answer.questionId));
  const detailsComplete =
    intakeReady ??
    (answerIds.has("workers") && answerIds.has("business-address") && answers.length >= 3);
  return normalizeRegistrationPlan({
    ...initialRegistrationPlan,
    steps: initialRegistrationPlan.steps.map((step) => ({
      ...step,
      status:
        registrationType === "Self-employed" &&
        ["name-registration", "local-clearance", "business-permit"].includes(step.id)
          ? "skipped"
          : step.id === "details"
            ? detailsComplete
              ? "completed"
              : "in_progress"
            : step.id === "structure"
              ? hasSearched
                ? "completed"
                : detailsComplete
                  ? "in_progress"
                  : "pending"
              : step.id === "name-registration"
                ? hasForm
                  ? "in_progress"
                  : hasSearched
                    ? "in_progress"
                    : "pending"
                : "pending",
    })),
  });
}

function lastDtiForm(messages: UIMessage[]) {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (part.type === "tool-editDtiBusinessNameForm" && part.state === "output-available")
        return (part.output as { form: DtiBusinessNameForm }).form;
    }
  return null;
}

function makePlan(
  prompt: string,
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
  generated?: GeneratedRoute,
): BusinessPlan {
  const inferred = inferCategory(prompt);
  const location = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const rdo = selectRdo(location, answers, `${prompt} ${profile?.barangay ?? ""}`);
  const labels = answers.flatMap((answer) => answer.labels);
  const hasEmployees =
    labels.some((label) => /yes|employee|worker/i.test(label) && !/no /i.test(label)) ||
    /\b(?:hire|hiring|team of \d+|\d+ (?:employees?|staff|workers?))\b/i.test(prompt);
  const hasPremises =
    labels.some((label) => /shop|office|commercial/i.test(label)) ||
    /\b(?:clinic|shop|office|storefront|commercial (?:space|unit)|physical (?:location|premises))\b/i.test(
      prompt,
    );
  const flags = [
    ...new Set([
      ...inferred.flags,
      ...(hasPremises ? ["physical-premises" as const] : []),
      ...(hasEmployees ? ["employees" as const] : []),
    ]),
  ];
  const registrationType =
    generated?.registrationType ??
    (inferred.category === "professional-services"
      ? ("Self-employed" as const)
      : ("Sole proprietor" as const));
  const category = generated?.category ?? inferred.category;
  const businessLabel =
    generated?.businessLabel ??
    (category === "professional-services"
      ? "Professional services"
      : category === "vehicle-rental"
        ? "Vehicle rental business"
        : category.startsWith("food")
          ? "Food business"
          : "New business");
  const generatedFlags = generated?.flags ?? [];
  const finalFlags = [...new Set([...flags, ...generatedFlags])];
  return {
    businessLabel,
    registrationType,
    city: location.city,
    setup: generated?.setup ?? labels.slice(0, 4),
    people: generated?.people ?? (hasEmployees ? 2 : 1),
    category,
    flags: finalFlags,
    rdo,
    rationale: buildRationale(
      registrationType,
      category,
      location.city,
      rdo,
      finalFlags,
      profile?.rdo,
    ),
    citations: citationsForPlan(registrationType, finalFlags),
  };
}

function answerValue(answers: IntakeAnswer[], questionId: string) {
  const value = answers.find((answer) => answer.questionId === questionId)?.value;
  return typeof value === "string" ? value.trim() : "";
}

function businessAddressFromAnswers(
  answers: IntakeAnswer[],
  residentialAddress: BnrsBusinessAddressInput | null,
): BnrsBusinessAddressInput | null {
  if (addressPreference(answers) === "profile" && residentialAddress) return residentialAddress;
  const addressLine1 = answerValue(answers, "business-address-line-1");
  const barangay = answerValue(answers, "business-barangay");
  const cityMunicipality = answerValue(answers, "business-city-municipality");
  const province = answerValue(answers, "business-province");
  const region = answerValue(answers, "business-region");
  const postalCode = answerValue(answers, "business-postal-code");
  if (
    !addressLine1 ||
    !barangay ||
    !cityMunicipality ||
    !province ||
    !region ||
    !/^\d{4}$/.test(postalCode)
  )
    return null;
  return {
    source: "USER_PROVIDED",
    addressLine1,
    barangay,
    cityMunicipality,
    province,
    region,
    postalCode,
  };
}

function businessAddressLabel(address: BnrsBusinessAddressInput | null) {
  if (!address) return "";
  return [
    address.addressLine1,
    address.addressLine2,
    address.barangay,
    address.cityMunicipality,
    address.province,
    address.region,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

async function completedBusinessRecord(input: {
  actor: ReturnType<typeof bnrsActorFromProfile>;
  answers: IntakeAnswer[];
  businessAddress: BnrsBusinessAddressInput | null;
  conversationId: string;
  payment: StoredPayment;
  profile: CitizenProfile;
  prompt: string;
}) {
  const plan = makePlan(input.prompt, input.profile, input.answers);
  if (plan.registrationType === "Self-employed")
    return finalizeBirSelfEmployedRegistration({
      businessActivity: plan.businessLabel,
      businessAddress:
        businessAddressLabel(input.businessAddress) || input.profile.address || plan.city,
      category: plan.category,
      city: plan.city,
      conversationId: input.conversationId,
      finalizedAt: input.payment.paidAt ?? input.payment.updatedAt,
      name: input.profile.fullName,
      ownerEgovUserId: input.actor.egovUserId,
      rdo: plan.rdo ? `${plan.rdo.code} - ${plan.rdo.name}` : "For BIR confirmation",
      tinMasked: input.profile.tinMasked,
    });

  const businessLink = await getBnrsConversationLink(input.actor.egovUserId, input.conversationId);
  if (!businessLink?.applicationId) return null;
  const business = await getBusiness({ actor: input.actor }, businessLink.applicationId);
  if (!business) return null;
  return finalizeBirSoleProprietorRegistration({
    business,
    finalizedAt: input.payment.paidAt ?? input.payment.updatedAt,
    ownerEgovUserId: input.actor.egovUserId,
  });
}

function appScopeLabel(
  scope: BnrsCatalog["scopes"][number],
): DtiBusinessNameForm["territorialScope"] {
  return scope.label === "City/Municipality" ? "City / municipality" : scope.label;
}

function composeProposedName(dominantName: string, descriptorLabel: string) {
  return [dominantName.trim(), descriptorLabel].filter(Boolean).join(" ");
}

function makeDtiForm(
  description: string,
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
  plan: BusinessPlan,
  catalog: BnrsCatalog,
  residentialAddress: BnrsBusinessAddressInput | null,
): DtiBusinessNameForm {
  const rawDominantName = answerValue(answers, "business-dominant-name");
  const dominantName = isMeaningfulBusinessName(rawDominantName) ? rawDominantName : "";
  const descriptorId = answerValue(answers, "business-descriptor");
  const descriptor = catalog.nameRequirements.descriptors.find(({ id }) => id === descriptorId);
  const scopeId = answerValue(answers, "business-territorial-scope");
  const scope = catalog.scopes.find(({ id }) => id === scopeId);
  const businessAddressDetails = businessAddressFromAnswers(answers, residentialAddress);
  const businessAddress = businessAddressLabel(businessAddressDetails);
  const termsAccepted = answerValue(answers, "bnrs-terms-accepted") === "accept";
  const missingFields = [
    ...(!dominantName ? ["Dominant business name"] : []),
    ...(!descriptor ? ["Business descriptor"] : []),
    ...(!scope ? ["Territorial scope"] : []),
    ...(!termsAccepted ? ["BNRS terms acceptance"] : []),
    ...(!businessAddressDetails ? ["Business address"] : []),
  ];
  return {
    applicationType: "New registration",
    status: missingFields.length ? "Draft" : "Ready to submit",
    dominantName,
    descriptorId: descriptor?.id ?? "",
    descriptorLabel: descriptor?.label ?? "",
    proposedName: composeProposedName(dominantName, descriptor?.label ?? ""),
    businessActivity: description.slice(0, 160),
    territorialScope: scope ? appScopeLabel(scope) : "City / municipality",
    territorialScopeId: scope?.id,
    ownerName: profile?.fullName ?? "",
    businessAddress,
    ...(businessAddressDetails ? { businessAddressDetails } : {}),
    city: plan.city,
    feeLabel: scope ? formatPeso(scope.totalFee) : "",
    termsAndConditions: catalog.termsAndConditions,
    businessNameRequirements: catalog.nameRequirements.reminders,
    termsAccepted,
    missingFields,
  };
}

function deterministicNext(
  prompt: string,
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
  catalog: BnrsCatalog,
  residentialAddress: BnrsBusinessAddressInput | null,
) {
  const questions = intakeBatch(prompt, profile, answers, catalog, residentialAddress);
  if (questions.length) return { questions };
  const plan = makePlan(prompt, profile, answers);
  if (plan.registrationType !== "Sole proprietor") return { plan };
  const form = makeDtiForm(prompt, profile, answers, plan, catalog, residentialAddress);
  const missingQuestions = questionsForIncompleteDtiForm(form, answers, catalog);
  if (missingQuestions.length) return { questions: missingQuestions };
  return { plan, form };
}

async function searchOfficialWeb(query: string, numResults = 5) {
  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  try {
    client = await createMCPClient({
      transport: {
        type: "http",
        url: "https://mcp.exa.ai/mcp?tools=web_search_exa",
        redirect: "follow",
        ...(process.env.EXA_API_KEY ? { headers: { "x-api-key": process.env.EXA_API_KEY } } : {}),
      },
    });
    const result = await client.callTool({
      name: "web_search_exa",
      arguments: { query, numResults },
      options: { timeout: 8_000 },
    });
    const text = JSON.stringify(result);
    const results: { title: string; url: string }[] = [];
    for (const match of text.matchAll(
      /Title:\\?n?([^"\\]+).*?URL:\\?n?(https?:\\?\/\\?\/[^"\\\s]+)/gi,
    )) {
      const url = match[2].replaceAll("\\/", "/");
      if (/\.gov\.ph\b|bir\.gov\.ph\b|dti\.gov\.ph\b/i.test(url))
        results.push({ title: match[1].trim(), url });
    }
    return { results: results.slice(0, 5) };
  } catch {
    return { results: [] };
  } finally {
    await client?.close();
  }
}

type EMessageToolsOptions = {
  allowTaxReminderRetry: boolean;
  dispatchKey: Omit<SmsDispatchKey, "recipient" | "toolName">;
  latestPrompt: string;
  profileMobile: string;
  reminderDefaults?: Omit<SimulateTaxPaymentReminderInput, "number">;
};

function authorizedSmsNumber(inputNumber: string | undefined, latestPrompt: string) {
  const mention = smsNumberMention(latestPrompt);
  if (mention.kind === "ambiguous")
    throw new Error("Provide exactly one recipient mobile number in the latest user message");
  if (mention.kind === "invalid") throw new Error("The mobile number supplied in chat is invalid");
  if (!inputNumber) return mention.kind === "valid" ? mention.number : undefined;
  if (mention.kind !== "valid")
    throw new Error("A tool-provided mobile number must be present in the latest user message");
  if (normalizeSmsNumber(inputNumber) !== mention.number)
    throw new Error("The tool recipient does not match the mobile number supplied in chat");
  return mention.number;
}

function emessageTools({
  allowTaxReminderRetry,
  dispatchKey,
  latestPrompt,
  profileMobile,
  reminderDefaults,
}: EMessageToolsOptions) {
  return {
    send_sms_message: tool({
      description:
        "Send an SMS through eMessage only when the citizen explicitly asks to send a message. Provide number only when the citizen supplied one in chat; otherwise omit it to use their authenticated eGov SSO mobile number.",
      inputSchema: sendSmsMessageInputSchema,
      execute: (input, { abortSignal }) => {
        if (!isExplicitSmsSendRequest(latestPrompt))
          throw new Error("The latest user message does not authorize sending an SMS");
        const number = authorizedSmsNumber(input.number, latestPrompt);
        const recipient = resolveSmsRecipient(number, profileMobile);
        return dispatchSmsOnce({ ...dispatchKey, recipient, toolName: "send_sms_message" }, () =>
          sendSmsMessage({ message: input.message, ...(number ? { number } : {}) }, profileMobile, {
            signal: abortSignal,
          }),
        );
      },
      toModelOutput: ({ output }) => ({ type: "json", value: output }),
    }),
    simulate_tax_payment_reminder: tool({
      description:
        "Simulate a tax payment reminder by sending a clearly labeled SMS through eMessage. Invoke only when the citizen's latest message explicitly asks to simulate the tax payment reminder. Omit number to use the authenticated eGov SSO mobile number.",
      inputSchema: simulateTaxPaymentReminderInputSchema,
      execute: (input, { abortSignal }) => {
        const authorized =
          isTaxPaymentReminderSimulationRequest(latestPrompt) ||
          (allowTaxReminderRetry && isTaxPaymentReminderRetryRequest(latestPrompt));
        if (!authorized)
          throw new Error(
            "The latest user message does not authorize a simulated tax payment reminder",
          );
        const number = authorizedSmsNumber(input.number, latestPrompt);
        const recipient = resolveSmsRecipient(number, profileMobile);
        return dispatchSmsOnce(
          { ...dispatchKey, recipient, toolName: "simulate_tax_payment_reminder" },
          () =>
            simulateTaxPaymentReminder(
              {
                ...reminderDefaults,
                ...input,
                ...(number ? { number } : { number: undefined }),
              },
              profileMobile,
              { signal: abortSignal },
            ),
        );
      },
      toModelOutput: ({ output }) => ({ type: "json", value: output }),
    }),
  };
}

function agentTools(
  request: Request,
  prompt: string,
  profile: CitizenProfile,
  rawProfile: EgovSsoCitizenProfile,
  userInfo: UserInfoOutput,
  hasUserInfo: boolean,
  latestPrompt: string,
  allowTaxReminderRetry: boolean,
  dispatchKey: Omit<SmsDispatchKey, "recipient" | "toolName">,
  businessCity: string,
  actor: ReturnType<typeof bnrsActorFromProfile>,
  bnrsAddress: BnrsBusinessAddressInput | null,
  catalog: BnrsCatalog,
  conversationId: string,
  termsAccepted: boolean,
) {
  let userInfoReady = hasUserInfo;
  return {
    ...emessageTools({
      profileMobile: profile.mobile,
      latestPrompt,
      allowTaxReminderRetry,
      dispatchKey,
    }),
    user_info: tool({
      description:
        "Report which verified eGov SSO fields are available for server-side form prefilling. Values remain private and are applied by form tools. Call this before preparing a form.",
      inputSchema: z.object({}),
      execute: () => {
        userInfoReady = true;
        return userInfo;
      },
    }),
    generate_bir_form: tool({
      description:
        "Generate a BIR PDF artifact. Select the supported form with type and provide any known form-specific fields under data; omitted values may be prefilled from the authenticated eGov SSO profile. Invoke only when the citizen explicitly asks to generate, create, prepare, fill, or prefill the BIR form. Never invoke proactively or for questions about the form. user_info must complete first.",
      inputSchema: generateBirFormInputSchema,
      execute: async (input) => {
        if (!userInfoReady) throw new Error("Call user_info before generate_bir_form");
        return {
          artifact: await createBirFormArtifact(request, rawProfile, input, conversationId),
          source: "BIR tool input merged with authenticated eGov SSO profile" as const,
        };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          artifact: output.artifact,
          source: output.source,
        },
      }),
    }),
    askUser: tool({
      description:
        "Ask one compact batch of consequential structured questions. This is a client-side tool. Stop after calling it.",
      inputSchema: z.object({
        questions: z.array(questionSchema).min(1).max(6),
      }),
    }),
    webSearch: tool({
      description: "Search official Philippine government sources when current evidence is useful.",
      inputSchema: z.object({
        query: z.string().min(5).max(180),
        numResults: z.number().int().min(1).max(6).default(5),
      }),
      execute: ({ query, numResults }) => searchOfficialWeb(query, numResults),
    }),
    editDtiBusinessNameForm: tool<EditDtiFormInput, EditDtiFormOutput, Record<string, unknown>>({
      description:
        "Create or revise a complete DTI Business Name Registration form. Keep the dominant name separate from an exact descriptor and territorial-scope ID in the supplied BNRS catalog. Never call with blank or missing fields; use askUser first for every unresolved required field.",
      inputSchema: z.object({ form: dtiFormSchema(catalog), note: z.string().max(180) }),
      execute: async ({ form }) => {
        if (!bnrsAddress)
          throw new Error("Ask for the complete structured business address before continuing.");
        const descriptor = catalog.nameRequirements.descriptors.find(
          ({ id }) => id === form.descriptorId,
        );
        const scope = catalog.scopes.find(({ id }) => id === form.territorialScopeId);
        if (!descriptor) throw new Error("Select an exact descriptor from the BNRS catalog.");
        if (!scope) throw new Error("Select an exact territorial scope from the BNRS catalog.");
        const application = await prepareBnrsApplication({
          actor,
          address: bnrsAddress,
          conversationId,
          descriptorId: descriptor.id,
          dominantName: form.dominantName,
          ownerProfile: rawProfile,
          scopeId: scope.id,
          termsAccepted,
        });
        const completeForm: DtiBusinessNameForm = {
          ...form,
          descriptorLabel: descriptor.label,
          proposedName: composeProposedName(form.dominantName, descriptor.label),
          territorialScope: appScopeLabel(scope),
          ownerName: profile.fullName,
          businessActivity: prompt.slice(0, 160),
          businessAddress: businessAddressLabel(bnrsAddress),
          businessAddressDetails: bnrsAddress,
          city: businessCity,
          feeLabel: formatPeso(scope.totalFee),
          termsAndConditions: catalog.termsAndConditions,
          businessNameRequirements: [...catalog.nameRequirements.reminders],
          termsAccepted,
          missingFields: [],
          status: "Ready to submit",
        };
        return { applicationId: application.applicationId, form: completeForm };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          form: {
            ...output.form,
            ownerName: "[server-prefilled verified name]",
            businessAddress: "[server-confirmed business address]",
            businessNameRequirements: [...(output.form.businessNameRequirements ?? [])],
          },
        },
      }),
    }),
    updatePlan: tool({
      description: "Create or update the concise registration checklist whenever progress changes.",
      inputSchema: registrationPlanSchema.extend({
        note: z.string().max(180).optional(),
      }),
      execute: (input) => ({
        plan: normalizeRegistrationPlan({
          title: input.title,
          steps: input.steps,
        }),
      }),
    }),
  };
}

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  const actor = bnrsActorFromProfile(session.rawProfile);

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const conversation = await getConversation(actor.egovUserId, parsed.data.id);
  if (!conversation) return Response.json({ error: "Chat session not found" }, { status: 404 });
  const managementBusiness =
    conversation.purpose === "management" && conversation.businessId
      ? await getBusiness({ actor }, conversation.businessId)
      : null;
  if (conversation.purpose === "management" && !managementBusiness)
    return Response.json({ error: "Chat session not found" }, { status: 404 });
  const messages = uniqueMessagesById(parsed.data.messages as BusinessChatMessage[]);
  await saveMessages(actor.egovUserId, conversation.id, messages);
  await setActiveStream(actor.egovUserId, conversation.id, null);
  const bnrsCatalog = readBnrsCatalog();
  const profile = session.profile;
  const latestUser = latestUserMessage(messages);
  const latestPrompt = latestUser?.text || parsed.data.initialPrompt;
  const failedReminderInput = immediatelyFailedTaxReminderInput(messages);
  const allowTaxReminderRetry = Boolean(failedReminderInput);
  const isTaxReminderRetry =
    allowTaxReminderRetry && isTaxPaymentReminderRetryRequest(latestPrompt);
  const shouldSendTaxReminder =
    isTaxPaymentReminderSimulationRequest(latestPrompt) || isTaxReminderRetry;
  if (!parsed.data.event && shouldSendTaxReminder) {
    const mention = smsNumberMention(latestPrompt);
    if (mention.kind === "ambiguous")
      return manualResponse(
        conversation.id,
        messages,
        (writer) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta:
              "I found more than one recipient number in that message, so I didn’t send anything. Please send a new message with exactly one mobile number.",
          });
          writer.write({ type: "text-end", id: textId });
        },
        { resumable: false },
      );

    let reminderDefaults: Omit<SimulateTaxPaymentReminderInput, "number"> = {};
    const retryChangesObligation = isTaxReminderRetry && hasTaxObligationReference(latestPrompt);
    if (isTaxReminderRetry && failedReminderInput && !retryChangesObligation) {
      const { number: _failedNumber, ...previousReminder } = failedReminderInput;
      reminderDefaults = previousReminder;
    } else if (managementBusiness) {
      const selection = selectTaxReminderObligation(
        managementBusiness.taxObligations,
        latestPrompt,
      );
      if (selection.kind === "ambiguous" || selection.kind === "not-found")
        return manualResponse(
          conversation.id,
          messages,
          (writer) => {
            const textId = crypto.randomUUID();
            writer.write({ type: "text-start", id: textId });
            writer.write({
              type: "text-delta",
              id: textId,
              delta:
                selection.kind === "not-found"
                  ? `I couldn’t find **${selection.reference}** in this business’s saved tax calendar, so I didn’t send a reminder.`
                  : "That message matches more than one saved tax obligation, so I didn’t send a reminder. Please name one BIR form.",
            });
            writer.write({ type: "text-end", id: textId });
          },
          { resumable: false },
        );
      const obligation = selection.kind === "selected" ? selection.obligation : undefined;
      reminderDefaults = {
        businessName: managementBusiness.name,
        ...(obligation?.title ? { taxTitle: obligation.title } : {}),
        ...(obligation?.formCode ? { formCode: obligation.formCode } : {}),
        ...(obligation?.dueDate ? { dueDate: obligation.dueDate } : {}),
      };
    } else if (retryChangesObligation) {
      return manualResponse(
        conversation.id,
        messages,
        (writer) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta:
              "I couldn’t match that changed tax obligation to a saved business tax calendar, so I didn’t send a reminder.",
          });
          writer.write({ type: "text-end", id: textId });
        },
        { resumable: false },
      );
    }

    const suppliedNumber =
      mention.kind === "valid" ? mention.number : mention.kind === "invalid" ? mention.value : null;
    const reminderInput: SimulateTaxPaymentReminderInput = {
      ...reminderDefaults,
      ...(suppliedNumber ? { number: suppliedNumber } : {}),
    };

    return manualResponse(conversation.id, messages, async (writer) => {
      const toolCallId = crypto.randomUUID();
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "simulate_tax_payment_reminder",
        input: reminderInput,
      });

      try {
        const recipient = resolveSmsRecipient(reminderInput.number, profile.mobile);
        const output = await dispatchSmsOnce(
          {
            actorId: profile.id,
            conversationId: conversation.id,
            recipient,
            toolName: "simulate_tax_payment_reminder",
            userMessageId: latestUser?.message.id ?? conversation.id,
          },
          () =>
            simulateTaxPaymentReminder(reminderInput, profile.mobile, {
              signal: request.signal,
            }),
        );
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output,
        });
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: `The simulated tax payment reminder was accepted by eMessage for **${output.recipient}**. This confirms provider acceptance, not delivery to the handset.`,
        });
        writer.write({ type: "text-end", id: textId });
      } catch (error) {
        console.warn("Simulated tax reminder failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        writer.write({
          type: "tool-output-error",
          toolCallId,
          errorText: "The simulated tax reminder could not be sent.",
        } as never);
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta:
            error instanceof SmsDispatchUncertainError
              ? "A prior reminder attempt may already have been accepted by eMessage, so I did not retry it. Check the handset or start a clearly new reminder request."
              : error instanceof SmsDispatchRateLimitError
                ? "The SMS sending limit has been reached, so I didn’t send the reminder. Please try again later."
                : "I couldn’t send the simulated tax payment reminder through eMessage. Check the verified recipient and eMessage server configuration, then try again.",
        });
        writer.write({ type: "text-end", id: textId });
      }
    });
  }
  const shouldSendSms = !shouldSendTaxReminder && isExplicitSmsSendRequest(latestPrompt);
  if (!parsed.data.event && shouldSendSms) {
    const message = extractExplicitSmsMessage(latestPrompt);
    if (!message)
      return manualResponse(
        conversation.id,
        messages,
        (writer) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta:
              'I didn’t send anything because the exact SMS body wasn’t clear. Please put the message in quotes, for example: `Send an SMS that says "Your filing is ready"`.',
          });
          writer.write({ type: "text-end", id: textId });
        },
        { resumable: false },
      );

    const mention = smsNumberMention(latestPrompt);
    if (mention.kind === "ambiguous")
      return manualResponse(
        conversation.id,
        messages,
        (writer) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta:
              "I found more than one recipient number in that message, so I didn’t send anything. Please send a new message with exactly one recipient number.",
          });
          writer.write({ type: "text-end", id: textId });
        },
        { resumable: false },
      );

    const suppliedNumber =
      mention.kind === "valid" ? mention.number : mention.kind === "invalid" ? mention.value : null;
    const parsedSmsInput = sendSmsMessageInputSchema.safeParse({
      message,
      ...(suppliedNumber ? { number: suppliedNumber } : {}),
    });
    if (!parsedSmsInput.success)
      return manualResponse(
        conversation.id,
        messages,
        (writer) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta:
              "I didn’t send anything because the SMS body or recipient is invalid. Keep the quoted message between 1 and 480 characters.",
          });
          writer.write({ type: "text-end", id: textId });
        },
        { resumable: false },
      );
    const smsInput = parsedSmsInput.data;
    return manualResponse(conversation.id, messages, async (writer) => {
      const toolCallId = crypto.randomUUID();
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "send_sms_message",
        input: smsInput,
      });
      try {
        const recipient = resolveSmsRecipient(smsInput.number, profile.mobile);
        const output = await dispatchSmsOnce(
          {
            actorId: profile.id,
            conversationId: conversation.id,
            recipient,
            toolName: "send_sms_message",
            userMessageId: latestUser?.message.id ?? conversation.id,
          },
          () => sendSmsMessage(smsInput, profile.mobile, { signal: request.signal }),
        );
        writer.write({ type: "tool-output-available", toolCallId, output });
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: `The SMS was accepted by eMessage for **${output.recipient}**. This confirms provider acceptance, not delivery to the handset.`,
        });
        writer.write({ type: "text-end", id: textId });
      } catch (error) {
        console.warn("SMS send failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        writer.write({
          type: "tool-output-error",
          toolCallId,
          errorText: "The SMS could not be sent.",
        } as never);
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta:
            error instanceof SmsDispatchUncertainError
              ? "A prior SMS attempt may already have been accepted by eMessage, so I did not retry it. Check the handset before starting a clearly new request."
              : error instanceof SmsDispatchRateLimitError
                ? "The SMS sending limit has been reached, so I didn’t send the message. Please try again later."
                : "I couldn’t send the SMS through eMessage. Check the verified recipient and eMessage server configuration, then try again.",
        });
        writer.write({ type: "text-end", id: textId });
      }
    });
  }
  if (managementBusiness)
    return managementResponse(
      actor.egovUserId,
      conversation.id,
      managementBusiness,
      messages,
      profile.id,
      profile.mobile,
    );
  const userInfoOutput: UserInfoOutput = {
    availableFields: availableUserInfoFields(profile),
    source: "eGov SSO",
  };
  const conversationText = userText(messages).trim();
  const prompt = conversationText || parsed.data.initialPrompt;
  const answers = toolAnswers(messages);
  const invalidAnswers = invalidIntakeAnswerIds(messages);
  const legacyBirFormConsent = answers.find(
    (answer) =>
      answer.questionId === "bir-form-consent" ||
      answer.questionId === "self-employed-bir-form-consent",
  );
  const legacyBirFormConsentValue = legacyBirFormConsent
    ? normalizedAnswerText(legacyBirFormConsent.value).toLowerCase()
    : null;
  const shouldGenerateLegacyBirForm =
    legacyBirFormConsentValue === "yes" && !hasCompletedTool(messages, "tool-generate_bir_form");
  const initialLocation = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const preference = addressPreference(answers);
  const residentialAddress = mapEgovSsoProfileToBnrsResidentialAddress(session.rawProfile);
  const bnrsAddress = businessAddressFromAnswers(answers, residentialAddress);
  const termsAccepted = answerValue(answers, "bnrs-terms-accepted") === "accept";
  const existingPlan = lastRegistrationPlan(messages);
  const hasSearched = messages.some((message) =>
    message.parts.some(
      (part) => part.type === "tool-webSearch" && part.state === "output-available",
    ),
  );
  const lastForm = lastDtiForm(messages);
  const hasUserInfo = messages.some((message) =>
    message.parts.some(
      (part) => part.type === "tool-user_info" && part.state === "output-available",
    ),
  );
  const tools = agentTools(
    request,
    prompt,
    profile,
    session.rawProfile,
    userInfoOutput,
    hasUserInfo,
    latestPrompt,
    allowTaxReminderRetry,
    {
      actorId: profile.id,
      conversationId: conversation.id,
      userMessageId: latestUser?.message.id ?? conversation.id,
    },
    initialLocation.city,
    actor,
    bnrsAddress,
    bnrsCatalog,
    conversation.id,
    termsAccepted,
  );
  const location = initialLocation;

  if (parsed.data.event === "payment-completed") {
    const paymentService: PaymentServiceType = parsed.data.paymentService ?? "dti-business-name";
    if (paymentService === "bir-documentary-stamp-tax") {
      if (!existingPlan)
        return Response.json({ error: "Registration plan not found." }, { status: 409 });
      let payment: StoredPayment;
      try {
        payment = await syncBirDstPaymentForConversation(conversation.id);
        if (!isPaidStatus(payment.status))
          return Response.json({ error: "Payment has not been marked paid." }, { status: 409 });
      } catch (error) {
        if (error instanceof BirDstPaymentError)
          return Response.json({ error: error.message, code: error.code }, { status: 409 });
        throw error;
      }
      const completedPlan = completeRegistrationPlan(existingPlan);
      const finalizedBusiness = await completedBusinessRecord({
        actor,
        answers,
        businessAddress: bnrsAddress,
        conversationId: conversation.id,
        payment,
        profile,
        prompt,
      });
      if (!finalizedBusiness)
        return Response.json({ error: "Business record was not found." }, { status: 409 });
      return manualResponse(actor.egovUserId, conversation.id, messages, (writer) => {
        emitTool(
          writer,
          "updatePlan",
          {
            ...completedPlan,
            note: "BIR documentary stamp tax payment verified. Required registration is complete.",
          },
          { plan: completedPlan },
        );
        emitTool(
          writer,
          "finalizeBusinessRegistration",
          {},
          {
            businessId: finalizedBusiness.id,
            businessName: finalizedBusiness.name,
            registrationNumber: finalizedBusiness.registrationNumber,
            status: finalizedBusiness.status,
          },
        );
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta:
            "Your ₱30 BIR Documentary Stamp Tax payment is verified, so this registration plan is complete. Books and invoices, sector-specific permits, and SSS, PhilHealth, or Pag-IBIG registration remain available as optional follow-ups and do not block completion.",
        });
        writer.write({ type: "text-end", id: textId });
      });
    }
    if (paymentService === "dti-business-name") {
      let certificate: BnrsCertificate | null;
      try {
        const result = await syncBnrsPaymentForConversation({
          actor,
          conversationId: conversation.id,
        });
        if (!result.registration)
          return Response.json({ error: "Payment has not been marked paid." }, { status: 409 });
        certificate = await getBnrsCertificateForConversation({
          actor,
          conversationId: conversation.id,
        });
      } catch (error) {
        if (error instanceof BnrsError)
          return Response.json({ error: error.message, code: error.code }, { status: 409 });
        throw error;
      }
      if (!certificate)
        return Response.json({ error: "BNRS certificate not found." }, { status: 409 });

      let lguStatus: LguApplicationStatus;
      try {
        lguStatus = await prepareLguApplication({
          actor,
          certificate,
          conversationId: conversation.id,
          ownerProfile: session.rawProfile,
        });
      } catch (error) {
        if (error instanceof LguError)
          return Response.json({ error: error.message, code: error.code }, { status: 409 });
        throw error;
      }
      const paidPlan = planAfterPayment(existingPlan);
      const permit = lguPermitSummary(lguStatus);
      return manualResponse(actor.egovUserId, conversation.id, messages, async (writer) => {
        emitTool(
          writer,
          "updatePlan",
          {
            ...paidPlan,
            note: "BNRS certificate issued. The combined LGU permit application is ready.",
          },
          { plan: paidPlan },
        );
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: `BNRS issued certificate **${certificate.certificateNumber}** for **${certificate.businessName}**. I passed that fresh credential to the DX LGU flow, which includes the business permit and barangay clearance in one assessment.`,
        });
        writer.write({ type: "text-end", id: textId });
        emitTool(writer, "prepareLguBusinessPermit", {}, { permit });
        emitTool(
          writer,
          "updatePlan",
          {
            ...paidPlan,
            note: "LGU application validated. One combined permit fee is ready for payment.",
          },
          { plan: paidPlan },
        );
      });
    }

    if (paymentService === "lgu-business-permit") {
      let status: LguApplicationStatus;
      let documents: LguIssuedDocuments | null;
      try {
        const result = await syncLguPaymentForConversation({
          actor,
          conversationId: conversation.id,
        });
        if (result.status.state !== "COMPLETED")
          return Response.json({ error: "Payment has not been marked paid." }, { status: 409 });
        const [currentStatus, linkedDocuments] = await Promise.all([
          getLguStatusForConversation({ actor, conversationId: conversation.id }),
          getLguDocumentsForConversation({ actor, conversationId: conversation.id }),
        ]);
        if (!currentStatus || !linkedDocuments)
          throw new LguError(
            "ISSUED_DOCUMENTS_NOT_FOUND",
            "The LGU documents have not been issued.",
          );
        status = currentStatus;
        documents = linkedDocuments;
      } catch (error) {
        if (error instanceof LguError)
          return Response.json({ error: error.message, code: error.code }, { status: 409 });
        throw error;
      }
      const issuedPlan = planAfterPermitIssued(existingPlan ?? initialRegistrationPlan);
      const permit = lguPermitSummary(status, documents);
      return manualResponse(actor.egovUserId, conversation.id, messages, async (writer) => {
        emitTool(writer, "issueLguBusinessPermit", {}, { permit });
        emitTool(
          writer,
          "updatePlan",
          {
            ...issuedPlan,
            note: "LGU payment verified; the permit and barangay clearance were issued together.",
          },
          { plan: issuedPlan },
        );
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: `The DX LGU flow issued business permit **${permit.businessPermitNumber}** and barangay clearance **${permit.barangayClearanceNumber}**. I’m generating BIR Form 1901 now; the app will not claim BIR registration until its required payment completes.`,
        });
        writer.write({ type: "text-end", id: textId });
        await emitBir1901Generation(
          writer,
          request,
          session.rawProfile,
          conversation.id,
          planForBirPayment(issuedPlan, "Sole proprietor"),
        );
      });
    }

    return Response.json({ error: "Unsupported payment service." }, { status: 400 });
  }

  if (parsed.data.event === "registration-completed") {
    if (!existingPlan || !planProgress(existingPlan).done)
      return Response.json({ error: "Registration plan is not complete." }, { status: 409 });
    let payment: StoredPayment;
    try {
      payment = await syncBirDstPaymentForConversation(conversation.id);
      if (!isPaidStatus(payment.status))
        return Response.json({ error: "Payment has not been marked paid." }, { status: 409 });
    } catch (error) {
      if (error instanceof BirDstPaymentError)
        return Response.json({ error: error.message, code: error.code }, { status: 409 });
      throw error;
    }
    const finalizedBusiness = await completedBusinessRecord({
      actor,
      answers,
      businessAddress: bnrsAddress,
      conversationId: conversation.id,
      payment,
      profile,
      prompt,
    });
    if (!finalizedBusiness)
      return Response.json({ error: "Business record was not found." }, { status: 409 });
    return manualResponse(actor.egovUserId, conversation.id, messages, (writer) => {
      emitTool(
        writer,
        "finalizeBusinessRegistration",
        {},
        {
          businessId: finalizedBusiness.id,
          businessName: finalizedBusiness.name,
          registrationNumber: finalizedBusiness.registrationNumber,
          status: finalizedBusiness.status,
        },
      );
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({
        type: "text-delta",
        id: textId,
        delta: "Your completed registration is now linked to its business record.",
      });
      writer.write({ type: "text-end", id: textId });
    });
  }

  if (shouldGenerateLegacyBirForm)
    return manualResponse(actor.egovUserId, conversation.id, messages, async (writer) => {
      if (!hasUserInfo) emitTool(writer, "user_info", {}, userInfoOutput);
      const route = makePlan(prompt, profile, answers);
      const birPaymentPlan = planForBirPayment(
        existingPlan ?? initialRegistrationPlan,
        route.registrationType,
      );
      await emitBir1901Generation(
        writer,
        request,
        session.rawProfile,
        conversation.id,
        birPaymentPlan,
      );
    });

  const firstTurn =
    messages.filter((message) => message.role === "user").length === 1 &&
    answers.length === 0 &&
    !lastForm;
  const continuingIntake =
    answers.length > 0 ||
    Boolean(existingPlan) ||
    isRegistrationStart(latestPrompt) ||
    describesBusinessIdea(parsed.data.initialPrompt) ||
    (firstTurn && describesBusinessIdea(latestPrompt));

  if (!lastForm && continuingIntake) {
    const questions = intakeBatch(prompt, profile, answers, bnrsCatalog, residentialAddress);
    if (questions.length) {
      const intakeRegistrationType = makePlan(prompt, profile, answers).registrationType;
      const currentPlan = planForAnswers(
        answers,
        hasSearched,
        false,
        false,
        intakeRegistrationType,
      );
      return manualResponse(actor.egovUserId, conversation.id, messages, (writer) => {
        if (!existingPlan || JSON.stringify(existingPlan) !== JSON.stringify(currentPlan))
          emitTool(
            writer,
            "updatePlan",
            { ...currentPlan, note: "Mapped the complete registration route." },
            { plan: currentPlan },
          );
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        const retryingInvalidAnswer = questions.some((question) => invalidAnswers.has(question.id));
        writer.write({
          type: "text-delta",
          id: textId,
          delta: retryingInvalidAnswer
            ? questions.length === 1
              ? "That answer looks incomplete. Please enter the full detail below."
              : "Some answers look incomplete. Please enter the full details below."
            : questions.length === 1
              ? "I only need this remaining detail."
              : `I only need these ${questions.length} remaining details.`,
        });
        writer.write({ type: "text-end", id: textId });
        writer.write({
          type: "tool-input-available",
          toolCallId: crypto.randomUUID(),
          toolName: "askUser",
          input: { questions },
        });
      });
    }
  }

  const businessPlan = makePlan(prompt, profile, answers);
  const currentPlan = planForAnswers(
    answers,
    hasSearched,
    Boolean(lastForm),
    true,
    businessPlan.registrationType,
  );

  if (
    continuingIntake &&
    !lastForm &&
    businessPlan.registrationType === "Self-employed" &&
    !hasCompletedTool(messages, "tool-prepareSelfEmployedRegistration")
  )
    return manualResponse(actor.egovUserId, conversation.id, messages, async (writer) => {
      const preparedPlan = normalizeRegistrationPlan({
        ...currentPlan,
        steps: currentPlan.steps.map((step) => ({
          ...step,
          status: [
            "details",
            "structure",
            "name-registration",
            "local-clearance",
            "business-permit",
          ].includes(step.id)
            ? step.id === "name-registration" ||
              step.id === "local-clearance" ||
              step.id === "business-permit"
              ? ("skipped" as const)
              : ("completed" as const)
            : step.id === "bir"
              ? ("in_progress" as const)
              : ("pending" as const),
        })),
      });
      emitTool(
        writer,
        "updatePlan",
        {
          ...preparedPlan,
          note: "Self-employed route confirmed. DTI is not required.",
        },
        { plan: preparedPlan },
      );
      emitTool(writer, "user_info", {}, userInfoOutput);
      const toolCallId = crypto.randomUUID();
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "prepareSelfEmployedRegistration",
        input: {},
      });
      writer.write({
        type: "tool-output-available",
        toolCallId,
        output: {
          registrationType: "Self-employed",
          taxpayerName: profile.fullName,
          professionalActivity: businessPlan.businessLabel,
          businessCity: businessPlan.city,
          rdo: businessPlan.rdo
            ? `${businessPlan.rdo.code} - ${businessPlan.rdo.name}`
            : "For BIR confirmation",
          addressSource: preference === "profile" ? "Authenticated profile" : "Business address",
          status: "Generating BIR Form 1901",
          nextAction: "Form 1901 is generated automatically. Next: ₱30 DST payment.",
        },
      });
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({
        type: "text-delta",
        id: textId,
        delta:
          "Your self-employed professional route goes directly to BIR; DTI business-name registration is not required when you operate under your legal name. I’m generating Form 1901 now.",
      });
      writer.write({ type: "text-end", id: textId });
      await emitBir1901Generation(
        writer,
        request,
        session.rawProfile,
        conversation.id,
        planForBirPayment(preparedPlan, "Self-employed"),
      );
    });

  if (!process.env.AI_GATEWAY_API_KEY) {
    if (!continuingIntake && !lastForm)
      return manualResponse(actor.egovUserId, conversation.id, messages, (writer) => {
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta:
            "I can help with that without starting a registration workflow. The conversational answer service is unavailable in this local setup right now; when you’re ready to register a business, tell me what you plan to start and I’ll build the route.",
        });
        writer.write({ type: "text-end", id: textId });
      });
    const next = deterministicNext(prompt, profile, answers, bnrsCatalog, residentialAddress);
    return manualResponse(actor.egovUserId, conversation.id, messages, async (writer) => {
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      const text =
        "questions" in next
          ? "Please complete these details together before I prepare your registration."
          : "I prepared this checkpoint. Next, review the application details and continue to payment when they are correct.";
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      if ("questions" in next)
        writer.write({
          type: "tool-input-available",
          toolCallId: crypto.randomUUID(),
          toolName: "askUser",
          input: { questions: next.questions },
        });
      else {
        if (next.form) {
          if (
            !next.form.businessAddressDetails ||
            !next.form.descriptorId ||
            !next.form.territorialScopeId
          )
            throw new Error("The BNRS application details are incomplete.");
          const application = await prepareBnrsApplication({
            actor,
            address: next.form.businessAddressDetails,
            conversationId: conversation.id,
            descriptorId: next.form.descriptorId,
            dominantName: next.form.dominantName ?? "",
            ownerProfile: session.rawProfile,
            scopeId: next.form.territorialScopeId,
            termsAccepted: next.form.termsAccepted === true,
          });
          emitTool(writer, "user_info", {}, userInfoOutput);
          const id = crypto.randomUUID();
          writer.write({
            type: "tool-input-available",
            toolCallId: id,
            toolName: "editDtiBusinessNameForm",
            input: {
              form: next.form,
              applicationId: application.applicationId,
              note: "Prepared from your profile and conversation.",
            },
          });
          writer.write({
            type: "tool-output-available",
            toolCallId: id,
            output: { applicationId: application.applicationId, form: next.form },
          });
        }
        writer.write({
          type: "data-plan",
          id: crypto.randomUUID(),
          data: { plan: next.plan },
        });
        emitTool(
          writer,
          "updatePlan",
          {
            ...planForAnswers(answers, false, Boolean(next.form), true),
            note: "Application prepared. Next, review and pay.",
          },
          { plan: planForAnswers(answers, false, Boolean(next.form), true) },
        );
      }
    });
  }

  if (
    continuingIntake &&
    !hasSearched &&
    !lastForm &&
    businessPlan.registrationType === "Sole proprietor"
  ) {
    const form = makeDtiForm(
      parsed.data.initialPrompt,
      profile,
      answers,
      businessPlan,
      bnrsCatalog,
      residentialAddress,
    );
    const missingQuestions = questionsForIncompleteDtiForm(form, answers, bnrsCatalog);
    if (missingQuestions.length)
      return manualResponse(actor.egovUserId, conversation.id, messages, (writer) => {
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta:
            missingQuestions.length === 1
              ? "I need one required detail before I can create the business-name registration form."
              : "I need these required details before I can create the business-name registration form.",
        });
        writer.write({ type: "text-end", id: textId });
        writer.write({
          type: "tool-input-available",
          toolCallId: crypto.randomUUID(),
          toolName: "askUser",
          input: { questions: missingQuestions },
        });
      });
    return manualResponse(actor.egovUserId, conversation.id, messages, async (writer) => {
      emitTool(
        writer,
        "updatePlan",
        { ...currentPlan, note: "Checking current DTI guidance." },
        { plan: currentPlan },
      );
      const query = `site:dti.gov.ph OR site:bnrs.dti.gov.ph business name registration ${form.territorialScope}`;
      const searchId = crypto.randomUUID();
      writer.write({
        type: "tool-input-available",
        toolCallId: searchId,
        toolName: "webSearch",
        input: { query, numResults: 5 },
      });
      const search = await searchOfficialWeb(query, 5);
      writer.write({
        type: "tool-output-available",
        toolCallId: searchId,
        output: search,
      });
      const afterSearch = planForAnswers(answers, true, false, true);
      emitTool(
        writer,
        "updatePlan",
        {
          ...afterSearch,
          note: "Official guidance checked. Preparing the application.",
        },
        { plan: afterSearch },
      );
      if (!form.businessAddressDetails || !form.descriptorId || !form.territorialScopeId)
        throw new Error("The BNRS application details are incomplete.");
      const application = await prepareBnrsApplication({
        actor,
        address: form.businessAddressDetails,
        conversationId: conversation.id,
        descriptorId: form.descriptorId,
        dominantName: form.dominantName ?? "",
        ownerProfile: session.rawProfile,
        scopeId: form.territorialScopeId,
        termsAccepted: form.termsAccepted === true,
      });
      const formId = crypto.randomUUID();
      emitTool(writer, "user_info", {}, userInfoOutput);
      writer.write({
        type: "tool-input-available",
        toolCallId: formId,
        toolName: "editDtiBusinessNameForm",
        input: {
          form,
          applicationId: application.applicationId,
          note: "Prepared from your profile and confirmed answers.",
        },
      });
      writer.write({
        type: "tool-output-available",
        toolCallId: formId,
        output: { applicationId: application.applicationId, form },
      });
      writer.write({
        type: "data-plan",
        id: crypto.randomUUID(),
        data: { plan: businessPlan },
      });
      const readyPlan = planForAnswers(answers, true, true, true);
      emitTool(
        writer,
        "updatePlan",
        { ...readyPlan, note: "The DTI application is ready for review." },
        { plan: readyPlan },
      );
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({
        type: "text-delta",
        id: textId,
        delta:
          "Your DTI business name application is ready. Next, review the fields and continue to eGovPay; after payment, we’ll move to local clearances and permits.",
      });
      writer.write({ type: "text-end", id: textId });
    });
  }

  const model = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY }).chat(
    process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite",
  );
  const result = streamText({
    model,
    tools,
    activeTools: [
      "user_info",
      "generate_bir_form",
      "send_sms_message",
      "simulate_tax_payment_reminder",
      "askUser",
      "webSearch",
      "editDtiBusinessNameForm",
      "updatePlan",
    ],
    stopWhen: stepCountIs(4),
    system: `You guide a Filipino citizen through business registration in a human-in-the-loop chat. Be concise, warm, and factual. Prefer short paragraphs and lists. Use a markdown table only when comparing three or more records; never use a table for a two-column field/value summary.

Standard intake questions are handled by the API router before this response. If you discover a consequential missing fact that prevents the next tool call, call askUser with one compact structured batch and stop. Never print A/B/C choices in prose. Never ask users to provide a TIN.

For an active registration workflow, every response must advance or explicitly block the workflow. If the next checkpoint is ready, call the applicable tool now; do not merely describe the step, offer to help later, or end with phrases such as “if you want” or “I can help with that next.” If required information is missing, call askUser. Prose-only responses are allowed only for unrelated informational requests, explicit requests to review/explain, tool errors, or a genuinely completed workflow.

Use updatePlan whenever registration progress changes. Keep the comprehensive 8–12 checkpoint plan and preserve stable step IDs. Mark finished work completed, requirements that do not apply to this route skipped, and keep at most one step in_progress. The tax-compliance, sector-permits, and employer steps are optional follow-ups: preserve optional: true on them and never let them block registration completion. Never mark a requirement completed merely because the user started at a later checkpoint. The current plan is ${JSON.stringify(existingPlan ?? currentPlan)}.

The user_info tool reports which authenticated eGov SSO fields are available for server-side form prefilling; it never returns their values to the model. It is ${hasUserInfo ? "already loaded in this conversation" : "not loaded yet"}. Call it before a government form tool when it has not already completed.

generate_bir_form creates a BIR PDF artifact from a discriminated input. Use type "1901" with Form 1901 data or type "1905" with Form 1905 data; every data field is optional and omitted identity values may be prefilled from the authenticated profile. Invoke it only when the citizen's latest message explicitly asks to generate, create, prepare, fill, or prefill that BIR form. Never invoke it proactively, for informational questions, or merely because BIR registration is part of the plan. Call user_info in an earlier tool step first when needed.

send_sms_message sends an SMS through eMessage. Invoke it only when the citizen's latest message explicitly asks to send an SMS or text message. Pass number only when the citizen supplied a recipient number in chat; otherwise omit number so the server uses the authenticated eGov SSO mobile number. Provider acceptance does not prove handset delivery.

simulate_tax_payment_reminder sends a clearly labeled simulated tax reminder through eMessage. Invoke it only when the citizen's latest message explicitly asks to simulate the tax payment reminder. Never invoke it for an ordinary question about tax dates, deadlines, filings, or obligations. Use saved business tax details when available; do not invent a tax form or due date.

The resolved business city is ${location.city}. Explicit locations override the profile. Reuse every fact the citizen has already stated and never ask for it again. Do not force registration steps when the latest request is unrelated or exploratory; answer that request directly and only return to the saved plan when the citizen asks. The resolved route is ${JSON.stringify(businessPlan)}.

The server-provided BNRS catalog is ${JSON.stringify(bnrsCatalog)}. Treat its terms, naming reminders, descriptor IDs, scopes, and fees as authoritative. Never create a descriptor or scope ID. Keep the citizen's dominant name separate from the selected descriptor; never split a complete proposed name heuristically.

For a sole proprietor, call user_info before creating or updating a DTI Business Name Registration draft with editDtiBusinessNameForm. Verified profile values stay server-side and the registered address may be used only after explicit consent. DTI handles sole-proprietor business-name registration; do not call it a BIR form. Preserve known fields and copy the exact profile owner name. Never invent an address or fee. If the business city differs from the profile city and no full business address was supplied, leave the address blank and list Business address under missingFields. Use only the exact BNRS descriptor and territorial-scope IDs already selected during intake. The citizen may correct any field in ordinary chat; apply the correction by calling editDtiBusinessNameForm with the full revised form. Current form: ${JSON.stringify(lastForm ? { ...lastForm, ownerName: lastForm.ownerName ? "[server-prefilled verified name]" : "", businessAddress: lastForm.businessAddress ? "[server-confirmed business address]" : "" } : null)}.

Use webSearch only when new current evidence is useful. Cite only returned official links. Never expose private reasoning. Do not claim submission or payment occurred. After every completed checkpoint, explicitly state the next concrete step.`,
    messages: await convertToModelMessages(messages, {
      tools,
      ignoreIncompleteToolCalls: true,
    }),
    timeout: { totalMs: 110_000, toolMs: 90_000 },
  });
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: false,
    onEnd: async ({ messages: completeMessages }) => {
      await saveMessages(actor.egovUserId, conversation.id, completeMessages);
      await setActiveStream(actor.egovUserId, conversation.id, null);
    },
    consumeSseStream: resumableConsumer(actor.egovUserId, conversation.id),
  });
}
