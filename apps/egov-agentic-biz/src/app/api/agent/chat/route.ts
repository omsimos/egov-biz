import { createMCPClient } from "@ai-sdk/mcp";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
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
import { fallbackQuestionFor, inferCategory } from "@/lib/business-rules";
import {
  buildRationale,
  citationsForPlan,
  locationQuestion,
  resolveBusinessLocation,
  selectRdo,
} from "@/lib/government-data";
import {
  uniqueMessagesById,
  type BarangayClearance,
  type BusinessChatMessage,
  type DtiBusinessNameForm,
  type EbplsBusinessPermitReceipt,
  type PaymentServiceType,
  type RegistrationPlan,
  type UserInfoOutput,
} from "@/lib/business-chat";
import { readSession } from "@/lib/auth/session";
import { createBirFormArtifact } from "@/lib/bir-form/artifact";
import { isExplicitBirFormRequest } from "@/lib/bir-form/request";
import {
  completeRegistrationPlan,
  initialRegistrationPlan,
  normalizeRegistrationPlan,
} from "@/lib/registration-plan";
import { dtiRegistrationFee, formatPeso } from "@/lib/dti-fees";
import type { CitizenProfile } from "@/lib/citizen-profile";
import {
  availableUserInfoFields,
  extractExplicitBusinessAddress,
  profileAddressPreference,
  resolveBusinessFormAddress,
} from "@/lib/form-prefill";
import type { BusinessPlan, IntakeAnswer, IntakeQuestion } from "@/lib/questions";
import { isValidChoiceAnswer } from "@/lib/intake-validation";
import { buildFinalBusiness, buildMockCompliance } from "@/lib/mock-compliance";
import { getConversation, saveMessages, setActiveStream } from "@/server/conversations";
import {
  getLatestPaymentForConversation,
  getLatestPaymentForService,
  isPaidStatus,
} from "@/server/payments";
import { getResumableContext } from "@/server/resumable";
import { upsertRegisteredBusiness } from "@/server/registered-businesses";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BARANGAY_CLEARANCE_MOCK_DELAY_MS = 2_000;
const EBPLS_PERMIT_MOCK_DELAY_MS = 5_000;
const COMPLIANCE_MOCK_DELAY_MS = 900;

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
  if (question?.type === "single" || question?.type === "multi")
    return isValidChoiceAnswer(question, answer.value);
  const text = normalizedAnswerText(answer.value);
  if (!text || PLACEHOLDER_ANSWER.test(text)) return false;
  if (answer.questionId === "business-address") return isCompleteBusinessAddress(text);
  if (answer.questionId === "proposed-business-name") return isMeaningfulBusinessName(text);
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
    helpText: z.string().max(180),
    type: z.enum(["single", "multi", "number", "text"]),
    options: z.array(optionSchema).max(8).optional(),
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
const dtiFormSchema = z.object({
  applicationType: z.literal("New registration"),
  status: z.enum(["Ready to submit", "Submitted"]),
  proposedName: z
    .string()
    .trim()
    .refine(isMeaningfulBusinessName, "A complete proposed business name is required"),
  businessActivity: z.string().trim().min(1),
  territorialScope: z.enum(["Barangay", "City / municipality", "Regional", "National"]),
  ownerName: z.string().trim().min(1),
  businessAddress: z
    .string()
    .trim()
    .refine(isCompleteBusinessAddress, "A complete business address is required"),
  city: z.string().trim().min(1),
  feeLabel: z.string().trim().min(1),
  missingFields: z.array(z.string()).max(0),
});
const barangayClearanceApplicationSchema = z.object({
  businessName: z.string(),
  ownerName: z.string(),
  businessActivity: z.string(),
  businessAddress: z.string(),
  barangay: z.string(),
  city: z.string(),
  registrationDocument: z.string(),
  supportingDocuments: z.array(z.string()),
});
const ebplsBusinessPermitApplicationSchema = z.object({
  system: z.literal("EBPLS"),
  permitType: z.literal("New business permit"),
  businessName: z.string(),
  ownerName: z.string(),
  businessActivity: z.string(),
  businessAddress: z.string(),
  barangay: z.string(),
  city: z.string(),
  barangayClearanceReference: z.string(),
  registrationDocument: z.string(),
  attachments: z.array(z.string()),
});
const planStepSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  status: z.enum(["pending", "in_progress", "completed", "skipped"]),
});
const registrationPlanSchema = z.object({
  title: z.string().min(1).max(120),
  steps: z.array(planStepSchema).min(2).max(12),
});
const paymentServiceSchema = z.enum([
  "dti-business-name",
  "barangay-clearance",
  "ebpls-business-permit",
]);
const requestSchema = z.object({
  id: z.string().uuid(),
  messages: z.array(z.unknown()),
  initialPrompt: z.string().trim().min(1).max(2_000),
  event: z.enum(["payment-completed"]).optional(),
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
    title: "Which address should this business use?",
    helpText: "Your registered eGov address is used only if you choose it here.",
    type: "single",
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

function lastBarangayClearance(messages: UIMessage[]) {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (part.type === "tool-submitBarangayClearance" && part.state === "output-available")
        return (part.output as { clearance: BarangayClearance }).clearance;
    }
  return null;
}

function lastEbplsReceipt(messages: UIMessage[]) {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (part.type === "tool-submitEbplsBusinessPermit" && part.state === "output-available")
        return (part.output as { receipt: EbplsBusinessPermitReceipt }).receipt;
    }
  return null;
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
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
) {
  const answered = new Set(answers.map((answer) => answer.questionId));
  const questions: IntakeQuestion[] = [];
  if (!isMeaningfulBusinessName(form.proposedName) && !answered.has("proposed-business-name"))
    questions.push(proposedNameQuestion());
  if (!isCompleteBusinessAddress(form.businessAddress) && !answered.has("business-address"))
    questions.push(
      businessAddressQuestion(form.city || profile?.city || "your city or municipality"),
    );
  return questions;
}

function describesBusinessIdea(prompt: string) {
  const value = prompt.toLowerCase();
  return (
    /\b(business|company|shop|store|clinic|practice|restaurant|bakery|cafe|coffee|food|catering|dental|dentist|medical|doctor|consulting|consultant|freelance|designer|developer|photograph|accounting|retail|rental|salon|laundry|agency|sole propriet|corporation|partnership)\b/.test(
      value,
    ) ||
    /\b(?:sell|selling|offer|offering|provide|providing)\b.{0,50}\b(?:service|services|product|products|food|drinks|online)\b/.test(
      value,
    )
  );
}

function latestUserText(messages: UIMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}

function planAfterBarangayClearance(plan: RegistrationPlan): RegistrationPlan {
  return normalizeRegistrationPlan({
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      status:
        step.id === "details" ||
        step.id === "structure" ||
        step.id === "name-registration" ||
        step.id === "local-clearance"
          ? "completed"
          : step.id === "business-permit"
            ? "in_progress"
            : "pending",
    })),
  });
}

function planAfterEbplsSubmission(plan: RegistrationPlan): RegistrationPlan {
  return normalizeRegistrationPlan({
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      status:
        step.id === "details" ||
        step.id === "structure" ||
        step.id === "name-registration" ||
        step.id === "local-clearance"
          ? "completed"
          : step.id === "business-permit"
            ? "in_progress"
            : "pending",
    })),
  });
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockReference(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function mockBarangayClearance(
  payment: NonNullable<ReturnType<typeof getLatestPaymentForConversation>>,
  form: DtiBusinessNameForm | null,
  profile: CitizenProfile | null,
): BarangayClearance {
  const submittedAt = new Date();
  const barangay = profile?.barangay || "Business-address barangay";
  const city = form?.city || profile?.city || "Local government unit";
  return {
    businessName: payment.proposedName,
    ownerName: payment.ownerName || profile?.fullName || "Registered owner",
    businessActivity: form?.businessActivity || "Business activity on registration record",
    businessAddress:
      form?.businessAddress || profile?.address || "Business address on registration record",
    barangay,
    city,
    registrationDocument: `DTI Business Name Certificate — ${payment.proposedName}`,
    supportingDocuments: [
      "DTI Business Name Certificate",
      "Government-issued ID",
      "Proof of business address",
      "Owner consent or lease, if applicable",
    ],
    status: "Payment required",
    referenceNumber: mockReference("BCLR"),
    submittedAt: submittedAt.toISOString(),
    approvedAt: null,
    validUntil: null,
    feeLabel: formatPeso(500),
    usedFor: [
      "Supporting document for the EBPLS mayor’s/business permit application",
      "Proof of barangay approval for the declared business location",
      "Local inspection and permit-record verification",
    ],
  };
}

function mockEbplsReceipt(clearance: BarangayClearance): EbplsBusinessPermitReceipt {
  const submittedAt = new Date();
  return {
    system: "EBPLS",
    permitType: "New business permit",
    businessName: clearance.businessName,
    ownerName: clearance.ownerName,
    businessActivity: clearance.businessActivity,
    businessAddress: clearance.businessAddress,
    barangay: clearance.barangay,
    city: clearance.city,
    barangayClearanceReference: clearance.referenceNumber,
    registrationDocument: clearance.registrationDocument,
    attachments: [
      clearance.registrationDocument,
      `Barangay Clearance ${clearance.referenceNumber}`,
      "Government-issued ID",
      "Proof of business address",
    ],
    status: "Payment required",
    referenceNumber: mockReference("EBPLS"),
    submittedAt: submittedAt.toISOString(),
    issuedAt: null,
    validUntil: null,
    feeLabel: formatPeso(2_500),
    nextAction:
      "Pay the assessed LGU fees through eGovPay so EBPLS can issue the mock mayor’s/business permit.",
  };
}

function approveBarangayClearance(clearance: BarangayClearance): BarangayClearance {
  const approvedAt = new Date();
  const validUntil = new Date(approvedAt);
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  return {
    ...clearance,
    status: "Approved",
    approvedAt: approvedAt.toISOString(),
    validUntil: validUntil.toISOString(),
  };
}

function issueEbplsPermit(receipt: EbplsBusinessPermitReceipt): EbplsBusinessPermitReceipt {
  const issuedAt = new Date();
  const validUntil = new Date(issuedAt.getFullYear(), 11, 31, 23, 59, 59);
  return {
    ...receipt,
    status: "Permit issued",
    issuedAt: issuedAt.toISOString(),
    validUntil: validUntil.toISOString(),
    nextAction: "Continue to BIR registration and retain this permit with the business records.",
  };
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

function resumableConsumer(conversationId: string) {
  return async ({ stream }: { stream: ReadableStream<string> }) => {
    const streamId = crypto.randomUUID();
    setActiveStream(conversationId, streamId);
    try {
      await getResumableContext().createNewResumableStream(streamId, () => stream);
    } catch (error) {
      setActiveStream(conversationId, null);
      console.error("Business chat resumable stream failed", error);
    }
  };
}

function manualResponse(
  conversationId: string,
  messages: BusinessChatMessage[],
  execute: (writer: UIMessageStreamWriter<BusinessChatMessage>) => Promise<void> | void,
) {
  const stream = createUIMessageStream<BusinessChatMessage>({
    originalMessages: messages,
    execute: ({ writer }) => execute(writer),
    onEnd: ({ messages: completeMessages }) => {
      saveMessages(conversationId, completeMessages);
      setActiveStream(conversationId, null);
    },
  });
  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: resumableConsumer(conversationId),
  });
}

function proposedNameQuestion(): IntakeQuestion {
  return {
    id: "proposed-business-name",
    eyebrow: "Business identity",
    title: "What business name do you want to register?",
    helpText: "Enter the complete proposed name. You can still revise it before payment.",
    type: "text",
    placeholder: "Proposed trade name",
  };
}

function isRegistrationStart(prompt: string) {
  const value = prompt.toLowerCase();
  const action = /\b(start|open|launch|set\s*up|establish|register|formalize|apply|create)\b/.test(
    value,
  );
  const subject =
    /\b(business|company|shop|store|clinic|practice|restaurant|bakery|cafe|service|freelance|sole propriet|corporation|partnership|permit|registration)\b/.test(
      value,
    );
  return action && subject;
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

function intakeBatch(prompt: string, profile: CitizenProfile | null, answers: IntakeAnswer[]) {
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
  const explicitAddress = extractExplicitBusinessAddress(prompt);
  const preference = addressPreference(answers);
  if (!explicitAddress && !preference && profile?.address.trim())
    questions.push(profileAddressQuestion());
  if (
    !explicitAddress &&
    !answered.has("business-address") &&
    (!profile?.address.trim() || preference === "different")
  )
    questions.push(businessAddressQuestion(location.city));
  const promptName =
    prompt
      .match(
        /(?:called|named|name is|business name(?: is|:)?|trade name(?: is|:)?)\s+[“"]?([^.”"\n]+)/i,
      )?.[1]
      ?.trim() ?? "";
  const registrationType = makePlan(prompt, profile, answers).registrationType;
  if (
    registrationType !== "Self-employed" &&
    !answered.has("proposed-business-name") &&
    !isMeaningfulBusinessName(promptName)
  )
    questions.push(proposedNameQuestion());
  return questions;
}

function businessAddressQuestion(city: string): IntakeQuestion {
  return {
    id: "business-address",
    eyebrow: "Location",
    title: `What is the complete business address in ${city}?`,
    helpText: "Include the house, unit, street, or building and the barangay—not just the city.",
    type: "text",
    placeholder: `Street or building, barangay, ${city}`,
  };
}

function toolAnswers(messages: UIMessage[]): IntakeAnswer[] {
  const answers = new Map<string, IntakeAnswer>();
  for (const message of messages)
    for (const part of message.parts) {
      if (part.type !== "tool-askUser" || part.state !== "output-available") continue;
      const input = part.input as { questions?: IntakeQuestion[]; question?: IntakeQuestion };
      const output = part.output as {
        answers?: { questionId: string; value: string | string[]; labels: string[] }[];
        value?: string | string[];
        labels?: string[];
      };
      const questions = input.questions ?? (input.question ? [input.question] : []);
      const submitted =
        output.answers ??
        (questions[0] && output.value !== undefined
          ? [{ questionId: questions[0].id, value: output.value, labels: output.labels ?? [] }]
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
      const input = part.input as { questions?: IntakeQuestion[]; question?: IntakeQuestion };
      const output = part.output as {
        answers?: { questionId: string; value: string | string[]; labels: string[] }[];
        value?: string | string[];
        labels?: string[];
      };
      const questions = input.questions ?? (input.question ? [input.question] : []);
      const submitted =
        output.answers ??
        (questions[0] && output.value !== undefined
          ? [{ questionId: questions[0].id, value: output.value, labels: output.labels ?? [] }]
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
  writer.write({ type: "tool-input-available", toolCallId, toolName, input } as never);
  writer.write({ type: "tool-output-available", toolCallId, output } as never);
}

function planForAnswers(
  answers: IntakeAnswer[],
  hasSearched: boolean,
  hasForm: boolean,
  intakeReady?: boolean,
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
        step.id === "details"
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

function answerText(answers: IntakeAnswer[], pattern: RegExp) {
  return (
    answers
      .find((answer) => pattern.test(`${answer.questionId} ${answer.question}`))
      ?.labels.join(", ") ?? ""
  );
}

function makeDtiForm(
  description: string,
  prompt: string,
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
  plan: BusinessPlan,
  usesProfileAddress: boolean,
): DtiBusinessNameForm {
  const proposedNameMatch = prompt.match(
    /(?:called|named|name is|business name(?: is|:)?|trade name(?: is|:)?)\s+[“"]?([^.”"\n]+)/i,
  );
  const rawProposedName =
    answerText(answers, /proposed.*name|business.*name|trade.*name/i) ||
    proposedNameMatch?.[1]?.trim() ||
    "";
  const proposedName = isMeaningfulBusinessName(rawProposedName) ? rawProposedName : "";
  const rawBusinessAddress = resolveBusinessFormAddress(
    extractExplicitBusinessAddress(prompt) ||
      answerText(answers, /business.*address|operating.*address|exact.*address/i),
    profile,
    usesProfileAddress,
  );
  const businessAddress = isCompleteBusinessAddress(rawBusinessAddress) ? rawBusinessAddress : "";
  const scope: DtiBusinessNameForm["territorialScope"] = /nationwide|national/i.test(prompt)
    ? "National"
    : /region(?:al|wide)/i.test(prompt)
      ? "Regional"
      : /barangay only|within (?:the )?barangay/i.test(prompt)
        ? "Barangay"
        : "City / municipality";
  const missingFields = [
    ...(!proposedName ? ["Proposed business name"] : []),
    ...(!businessAddress ? ["Business address"] : []),
  ];
  return {
    applicationType: "New registration",
    status: missingFields.length ? "Draft" : "Ready to submit",
    proposedName,
    businessActivity: description.slice(0, 160),
    territorialScope: scope,
    ownerName: profile?.fullName ?? "",
    businessAddress,
    city: plan.city,
    feeLabel: formatPeso(dtiRegistrationFee(scope)),
    missingFields,
  };
}

function deterministicNext(
  prompt: string,
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
) {
  const questions = intakeBatch(prompt, profile, answers);
  if (questions.length) return { questions };
  const plan = makePlan(prompt, profile, answers);
  if (plan.registrationType !== "Sole proprietor") return { plan };
  const form = makeDtiForm(
    prompt,
    prompt,
    profile,
    answers,
    plan,
    addressPreference(answers) === "profile",
  );
  const missingQuestions = questionsForIncompleteDtiForm(form, profile, answers);
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

function agentTools(
  request: Request,
  prompt: string,
  profile: CitizenProfile,
  rawProfile: EgovSsoCitizenProfile,
  userInfo: UserInfoOutput,
  hasUserInfo: boolean,
  businessCity: string,
  usesProfileAddress: boolean,
  confirmedBusinessAddress: string,
) {
  let userInfoReady = hasUserInfo;
  return {
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
        "Generate a prefilled BIR Form 1901 PDF artifact from the authenticated eGov SSO profile. Invoke only when the citizen explicitly asks to generate, create, prepare, fill, or prefill the BIR form. Never invoke proactively or for questions about the form. user_info must complete first.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!userInfoReady) throw new Error("Call user_info before generate_bir_form");
        return {
          artifact: await createBirFormArtifact(request, rawProfile),
          source: "Authenticated eGov SSO profile" as const,
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
      inputSchema: z.object({ questions: z.array(questionSchema).min(1).max(6) }),
    }),
    webSearch: tool({
      description: "Search official Philippine government sources when current evidence is useful.",
      inputSchema: z.object({
        query: z.string().min(5).max(180),
        numResults: z.number().int().min(1).max(6).default(5),
      }),
      execute: ({ query, numResults }) => searchOfficialWeb(query, numResults),
    }),
    editDtiBusinessNameForm: tool({
      description:
        "Create or revise a complete DTI Business Name Registration form. Never call with blank or missing fields; use askUser first for every unresolved required field.",
      inputSchema: z.object({ form: dtiFormSchema, note: z.string().max(180) }),
      execute: ({ form }) => {
        const businessAddress = resolveBusinessFormAddress(
          confirmedBusinessAddress || form.businessAddress,
          profile,
          usesProfileAddress,
        );
        if (!isCompleteBusinessAddress(businessAddress))
          throw new Error(
            "Ask the user for the complete business address before creating the DTI form.",
          );
        return {
          form: {
            ...form,
            ownerName: profile.fullName,
            businessActivity: prompt.slice(0, 160),
            businessAddress,
            city: businessCity,
            feeLabel: formatPeso(dtiRegistrationFee(form.territorialScope)),
            missingFields: [],
            status: "Ready to submit" as const,
          },
        };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          form: {
            ...output.form,
            ownerName: "[server-prefilled verified name]",
            businessAddress: "[server-confirmed business address]",
          },
        },
      }),
    }),
    submitBarangayClearance: tool({
      description:
        "Submit an electronic barangay business-clearance request and return the clearance response.",
      inputSchema: z.object({ application: barangayClearanceApplicationSchema }),
    }),
    submitEbplsBusinessPermit: tool({
      description:
        "Submit a mayor's or business-permit application through EBPLS (Electronic Business Permits and Licensing System).",
      inputSchema: z.object({ application: ebplsBusinessPermitApplicationSchema }),
    }),
    updatePlan: tool({
      description: "Create or update the concise registration checklist whenever progress changes.",
      inputSchema: registrationPlanSchema.extend({ note: z.string().max(180).optional() }),
      execute: (input) => ({
        plan: normalizeRegistrationPlan({ title: input.title, steps: input.steps }),
      }),
    }),
  };
}

export async function POST(request: Request) {
  const session = readSession(request);
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const conversation = getConversation(parsed.data.id);
  if (!conversation) return Response.json({ error: "Chat session not found" }, { status: 404 });
  const messages = uniqueMessagesById(parsed.data.messages as BusinessChatMessage[]);
  saveMessages(conversation.id, messages);
  setActiveStream(conversation.id, null);
  const profile = session.profile;
  const userInfoOutput: UserInfoOutput = {
    availableFields: availableUserInfoFields(profile),
    source: "eGov SSO",
  };
  const conversationText = userText(messages).trim();
  const prompt = conversationText || parsed.data.initialPrompt;
  const latestPrompt = latestUserText(messages) || parsed.data.initialPrompt;
  const answers = toolAnswers(messages);
  const invalidAnswers = invalidIntakeAnswerIds(messages);
  const initialLocation = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const preference = addressPreference(answers);
  const confirmedBusinessAddress =
    extractExplicitBusinessAddress(prompt) ||
    answerText(answers, /business.*address|operating.*address|exact.*address/i);
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
    initialLocation.city,
    preference === "profile",
    confirmedBusinessAddress,
  );
  const previousClearance = lastBarangayClearance(messages);
  const previousEbplsReceipt = lastEbplsReceipt(messages);
  const location = initialLocation;

  if (parsed.data.event === "payment-completed") {
    const paymentService: PaymentServiceType = parsed.data.paymentService ?? "dti-business-name";
    const payment = getLatestPaymentForService(conversation.id, paymentService);
    if (!payment || !isPaidStatus(payment.status))
      return Response.json({ error: "Payment has not been marked paid." }, { status: 409 });
    if (paymentService === "barangay-clearance") {
      if (!previousClearance)
        return Response.json(
          { error: "Barangay clearance assessment not found." },
          { status: 409 },
        );
      const clearance = approveBarangayClearance(previousClearance);
      const permitPlan = planAfterBarangayClearance(existingPlan ?? planAfterPayment(null));
      return manualResponse(conversation.id, messages, async (writer) => {
        const barangayId = crypto.randomUUID();
        writer.write({
          type: "tool-input-available",
          toolCallId: barangayId,
          toolName: "submitBarangayClearance",
          input: {
            application: {
              businessName: clearance.businessName,
              ownerName: clearance.ownerName,
              businessActivity: clearance.businessActivity,
              businessAddress: clearance.businessAddress,
              barangay: clearance.barangay,
              city: clearance.city,
              registrationDocument: clearance.registrationDocument,
              supportingDocuments: clearance.supportingDocuments,
            },
          },
        });
        await wait(BARANGAY_CLEARANCE_MOCK_DELAY_MS);
        writer.write({
          type: "tool-output-available",
          toolCallId: barangayId,
          output: { clearance },
        });
        emitTool(
          writer,
          "updatePlan",
          {
            ...permitPlan,
            note: "Barangay clearance paid and approved. Starting EBPLS assessment.",
          },
          { plan: permitPlan },
        );
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta:
            "The barangay clearance is paid and approved. I’m attaching it to the mayor’s/business permit application through **EBPLS — Electronic Business Permits and Licensing System**.",
        });
        writer.write({ type: "text-end", id: textId });
        const receipt = mockEbplsReceipt(clearance);
        const ebplsId = crypto.randomUUID();
        writer.write({
          type: "tool-input-available",
          toolCallId: ebplsId,
          toolName: "submitEbplsBusinessPermit",
          input: {
            application: {
              system: receipt.system,
              permitType: receipt.permitType,
              businessName: receipt.businessName,
              ownerName: receipt.ownerName,
              businessActivity: receipt.businessActivity,
              businessAddress: receipt.businessAddress,
              barangay: receipt.barangay,
              city: receipt.city,
              barangayClearanceReference: receipt.barangayClearanceReference,
              registrationDocument: receipt.registrationDocument,
              attachments: receipt.attachments,
            },
          },
        });
        await wait(EBPLS_PERMIT_MOCK_DELAY_MS);
        writer.write({ type: "tool-output-available", toolCallId: ebplsId, output: { receipt } });
        emitTool(
          writer,
          "updatePlan",
          {
            ...planAfterEbplsSubmission(permitPlan),
            note: "EBPLS assessment complete. LGU fee payment is required.",
          },
          { plan: planAfterEbplsSubmission(permitPlan) },
        );
      });
    }
    if (paymentService === "ebpls-business-permit") {
      if (!previousEbplsReceipt)
        return Response.json({ error: "EBPLS assessment not found." }, { status: 409 });
      const receipt = issueEbplsPermit(previousEbplsReceipt);
      const issuedPlan = planAfterPermitIssued(existingPlan ?? initialRegistrationPlan);
      const businessPlan = makePlan(prompt, profile, answers);
      const compliance = buildMockCompliance(businessPlan, receipt);
      const sectorRecords = compliance.records.filter((record) => record.kind === "permit");
      const employerRecords = compliance.records.filter((record) => record.kind === "employer");
      const taxRecords = compliance.records.filter((record) => record.kind === "tax");
      const booksAndInvoiceRecords = taxRecords.filter((record) =>
        ["books-of-accounts", "invoice-setup"].includes(record.id),
      );
      const registrationTaxRecords = taxRecords.filter(
        (record) => !booksAndInvoiceRecords.includes(record),
      );
      const sectorRequired = sectorRecords.some((record) => record.status !== "Not required");
      const employerRequired = employerRecords.some((record) => record.status !== "Not required");
      const completedPlan = completeRegistrationPlan(issuedPlan, {
        employer: employerRequired,
        sectorPermits: sectorRequired,
      });
      const business = upsertRegisteredBusiness(
        profile.id,
        buildFinalBusiness({
          conversationId: conversation.id,
          profile,
          plan: businessPlan,
          dtiForm: lastForm,
          clearance: previousClearance,
          receipt,
          compliance,
        }),
      );
      return manualResponse(conversation.id, messages, async (writer) => {
        const ebplsId = crypto.randomUUID();
        writer.write({
          type: "tool-input-available",
          toolCallId: ebplsId,
          toolName: "submitEbplsBusinessPermit",
          input: {
            application: {
              system: receipt.system,
              permitType: receipt.permitType,
              businessName: receipt.businessName,
              ownerName: receipt.ownerName,
              businessActivity: receipt.businessActivity,
              businessAddress: receipt.businessAddress,
              barangay: receipt.barangay,
              city: receipt.city,
              barangayClearanceReference: receipt.barangayClearanceReference,
              registrationDocument: receipt.registrationDocument,
              attachments: receipt.attachments,
            },
          },
        });
        await wait(EBPLS_PERMIT_MOCK_DELAY_MS);
        writer.write({ type: "tool-output-available", toolCallId: ebplsId, output: { receipt } });
        emitTool(
          writer,
          "updatePlan",
          { ...issuedPlan, note: "Mayor’s/business permit issued. Moving to BIR registration." },
          { plan: issuedPlan },
        );
        await wait(COMPLIANCE_MOCK_DELAY_MS);
        const booksToolId = crypto.randomUUID();
        writer.write({
          type: "tool-input-available",
          toolCallId: booksToolId,
          toolName: "setupBooksAndInvoices",
          input: {},
        });
        await wait(COMPLIANCE_MOCK_DELAY_MS);
        writer.write({
          type: "tool-output-available",
          toolCallId: booksToolId,
          output: { records: booksAndInvoiceRecords },
        });
        emitTool(
          writer,
          "setupTaxCompliance",
          {},
          {
            records: registrationTaxRecords,
            obligations: compliance.taxObligations,
          },
        );
        await wait(COMPLIANCE_MOCK_DELAY_MS);
        emitTool(writer, "completeSectorPermits", {}, { records: sectorRecords });
        await wait(COMPLIANCE_MOCK_DELAY_MS);
        emitTool(writer, "registerEmployerAgencies", {}, { records: employerRecords });
        emitTool(
          writer,
          "updatePlan",
          { ...completedPlan, note: "Demo compliance setup complete and business record saved." },
          { plan: completedPlan },
        );
        emitTool(
          writer,
          "finalizeBusinessRegistration",
          {},
          {
            businessId: business.id,
            businessName: business.name,
            status: business.status,
          },
        );
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: `**All set up.** The demo registration for **${business.name}** is complete, including books, invoices, recurring tax reminders, permits, and employer checks. I saved everything to your linked business record. Every generated reference is marked as a mock and is not an official government record.`,
        });
        writer.write({ type: "text-end", id: textId });
      });
    }
    const paidPlan = planAfterPayment(existingPlan);
    return manualResponse(conversation.id, messages, async (writer) => {
      emitTool(
        writer,
        "updatePlan",
        { ...paidPlan, note: "Payment recorded. Moving to local clearance requirements." },
        { plan: paidPlan },
      );
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({
        type: "text-delta",
        id: textId,
        delta: `Payment is marked paid for **${payment.proposedName}**. Next, I’m submitting the barangay business-clearance request electronically using the registration and address details already on file.`,
      });
      writer.write({ type: "text-end", id: textId });
      const clearance = mockBarangayClearance(payment, lastForm, profile);
      const barangayId = crypto.randomUUID();
      writer.write({
        type: "tool-input-available",
        toolCallId: barangayId,
        toolName: "submitBarangayClearance",
        input: {
          application: {
            businessName: clearance.businessName,
            ownerName: clearance.ownerName,
            businessActivity: clearance.businessActivity,
            businessAddress: clearance.businessAddress,
            barangay: clearance.barangay,
            city: clearance.city,
            registrationDocument: clearance.registrationDocument,
            supportingDocuments: clearance.supportingDocuments,
          },
        },
      });
      await wait(BARANGAY_CLEARANCE_MOCK_DELAY_MS);
      writer.write({
        type: "tool-output-available",
        toolCallId: barangayId,
        output: { clearance },
      });
      emitTool(
        writer,
        "updatePlan",
        { ...paidPlan, note: "Barangay clearance assessed. Payment is required before approval." },
        { plan: paidPlan },
      );
    });
  }

  if (isExplicitBirFormRequest(latestPrompt))
    return manualResponse(conversation.id, messages, async (writer) => {
      if (!hasUserInfo) emitTool(writer, "user_info", {}, userInfoOutput);
      const toolCallId = crypto.randomUUID();
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "generate_bir_form",
        input: {},
      });

      let text: string;
      try {
        const output = {
          artifact: await createBirFormArtifact(request, session.rawProfile),
          source: "Authenticated eGov SSO profile" as const,
        };
        writer.write({ type: "tool-output-available", toolCallId, output });
        text = "Your prefilled BIR Form 1901 is ready. Select the PDF to preview it.";
      } catch (error) {
        console.warn("BIR form artifact generation failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        writer.write({
          type: "tool-output-error",
          toolCallId,
          errorText: "The PDF could not be generated.",
        } as never);
        text = "I couldn’t generate the BIR form PDF. Please try again.";
      }

      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
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
    const questions = intakeBatch(prompt, profile, answers);
    if (questions.length) {
      const currentPlan = planForAnswers(answers, hasSearched, false, false);
      return manualResponse(conversation.id, messages, (writer) => {
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

  if (!process.env.AI_GATEWAY_API_KEY) {
    if (!continuingIntake && !lastForm)
      return manualResponse(conversation.id, messages, (writer) => {
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
    const next = deterministicNext(prompt, profile, answers);
    return manualResponse(conversation.id, messages, (writer) => {
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
          emitTool(writer, "user_info", {}, userInfoOutput);
          const id = crypto.randomUUID();
          writer.write({
            type: "tool-input-available",
            toolCallId: id,
            toolName: "editDtiBusinessNameForm",
            input: { form: next.form, note: "Prepared from your profile and conversation." },
          });
          writer.write({
            type: "tool-output-available",
            toolCallId: id,
            output: { form: next.form },
          });
        }
        writer.write({ type: "data-plan", id: crypto.randomUUID(), data: { plan: next.plan } });
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

  const businessPlan = makePlan(prompt, profile, answers);
  const currentPlan = planForAnswers(answers, hasSearched, Boolean(lastForm), true);

  if (
    continuingIntake &&
    !lastForm &&
    businessPlan.registrationType === "Self-employed" &&
    !hasCompletedTool(messages, "tool-prepareSelfEmployedRegistration")
  )
    return manualResponse(conversation.id, messages, (writer) => {
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
        { ...preparedPlan, note: "Self-employed route confirmed. Preparing the BIR checkpoint." },
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
          status: "Ready for BIR form preparation",
          nextAction: "Ask me to prepare BIR Form 1901 when you are ready to generate the PDF.",
          demo: true,
        },
      });
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({
        type: "text-delta",
        id: textId,
        delta:
          "I’ve prepared your self-employed BIR registration checkpoint using the details you confirmed. The next executable step is generating the prefilled BIR Form 1901.",
      });
      writer.write({ type: "text-end", id: textId });
    });

  if (
    continuingIntake &&
    !hasSearched &&
    !lastForm &&
    businessPlan.registrationType === "Sole proprietor"
  ) {
    const form = makeDtiForm(
      parsed.data.initialPrompt,
      prompt,
      profile,
      answers,
      businessPlan,
      preference === "profile",
    );
    const missingQuestions = questionsForIncompleteDtiForm(form, profile, answers);
    if (missingQuestions.length)
      return manualResponse(conversation.id, messages, (writer) => {
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
    return manualResponse(conversation.id, messages, async (writer) => {
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
      writer.write({ type: "tool-output-available", toolCallId: searchId, output: search });
      const afterSearch = planForAnswers(answers, true, false, true);
      emitTool(
        writer,
        "updatePlan",
        { ...afterSearch, note: "Official guidance checked. Preparing the application." },
        { plan: afterSearch },
      );
      const formId = crypto.randomUUID();
      emitTool(writer, "user_info", {}, userInfoOutput);
      writer.write({
        type: "tool-input-available",
        toolCallId: formId,
        toolName: "editDtiBusinessNameForm",
        input: { form, note: "Prepared from your profile and confirmed answers." },
      });
      writer.write({ type: "tool-output-available", toolCallId: formId, output: { form } });
      writer.write({ type: "data-plan", id: crypto.randomUUID(), data: { plan: businessPlan } });
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
      "askUser",
      "webSearch",
      "editDtiBusinessNameForm",
      "updatePlan",
    ],
    stopWhen: stepCountIs(4),
    system: `You guide a Filipino citizen through business registration in a human-in-the-loop chat. Be concise, warm, and factual. Prefer short paragraphs and lists. Use a markdown table only when comparing three or more records; never use a table for a two-column field/value summary.

Standard intake questions are handled by the API router before this response. If you discover a consequential missing fact that prevents the next tool call, call askUser with one compact structured batch and stop. Never print A/B/C choices in prose. Never ask users to provide a TIN.

For an active registration workflow, every response must advance or explicitly block the workflow. If the next checkpoint is ready, call the applicable tool now; do not merely describe the step, offer to help later, or end with phrases such as “if you want” or “I can help with that next.” If required information is missing, call askUser. Prose-only responses are allowed only for unrelated informational requests, explicit requests to review/explain, tool errors, or a genuinely completed workflow.

Use updatePlan whenever registration progress changes. Keep the comprehensive 8–12 checkpoint plan and preserve stable step IDs. Mark finished work completed, requirements that do not apply to this route skipped, and keep at most one step in_progress. Never mark a requirement completed merely because the user started at a later checkpoint. The current plan is ${JSON.stringify(existingPlan ?? currentPlan)}.

The user_info tool reports which authenticated eGov SSO fields are available for server-side form prefilling; it never returns their values to the model. It is ${hasUserInfo ? "already loaded in this conversation" : "not loaded yet"}. Call it before a government form tool when it has not already completed.

generate_bir_form creates a prefilled BIR Form 1901 PDF artifact. Invoke it only when the citizen's latest message explicitly asks to generate, create, prepare, fill, or prefill that BIR form. Never invoke it proactively, for informational questions, or merely because BIR registration is part of the plan. Call user_info in an earlier tool step first when needed. The tool takes no citizen data as input and applies authenticated profile values server-side.

The resolved business city is ${location.city}. Explicit locations override the profile. Reuse every fact the citizen has already stated and never ask for it again. Do not force registration steps when the latest request is unrelated or exploratory; answer that request directly and only return to the saved plan when the citizen asks. The resolved route is ${JSON.stringify(businessPlan)}.

For a sole proprietor, call user_info before creating or updating a DTI Business Name Registration draft with editDtiBusinessNameForm. Verified profile values stay server-side and the registered address may be used only after explicit consent. DTI handles sole-proprietor business-name registration; do not call it a BIR form. Preserve known fields and copy the exact profile owner name. Never invent an address or fee. If the business city differs from the profile city and no full business address was supplied, leave the address blank and list Business address under missingFields. Use the official DTI territorial-scope fee plus documentary stamp supplied by the application; never invent a fee. The citizen may correct any field in ordinary chat; apply the correction by calling editDtiBusinessNameForm with the full revised form. Current form: ${JSON.stringify(lastForm ? { ...lastForm, ownerName: lastForm.ownerName ? "[server-prefilled verified name]" : "", businessAddress: lastForm.businessAddress ? "[server-confirmed business address]" : "" } : null)}.

Use webSearch only when new current evidence is useful. Cite only returned official links. Never expose private reasoning. Do not claim submission or payment occurred. After every completed checkpoint, explicitly state the next concrete step.`,
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    timeout: { totalMs: 35_000, toolMs: 10_000 },
  });
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: false,
    onEnd: ({ messages: completeMessages }) => {
      saveMessages(conversation.id, completeMessages);
      setActiveStream(conversation.id, null);
    },
    consumeSseStream: resumableConsumer(conversation.id),
  });
}
