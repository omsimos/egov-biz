import { createMCPClient } from "@ai-sdk/mcp";
import {
  convertToModelMessages,
  createGateway,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
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
import type {
  BusinessChatMessage,
  DtiBusinessNameForm,
  RegistrationPlan,
  UserInfoOutput,
} from "@/lib/business-chat";
import { readSession } from "@/lib/auth/session";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { initialRegistrationPlan } from "@/lib/registration-plan";
import { dtiRegistrationFee, formatPeso } from "@/lib/dti-fees";
import {
  availableUserInfoFields,
  extractExplicitBusinessAddress,
  profileAddressPreference,
  resolveBusinessFormAddress,
} from "@/lib/form-prefill";
import type { BusinessPlan, IntakeAnswer, IntakeQuestion } from "@/lib/questions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  status: z.enum(["Draft", "Ready to submit", "Submitted"]),
  proposedName: z.string(),
  businessActivity: z.string(),
  territorialScope: z.enum(["Barangay", "City / municipality", "Regional", "National"]),
  ownerName: z.string(),
  businessAddress: z.string(),
  city: z.string(),
  feeLabel: z.string(),
  missingFields: z.array(z.string()),
});
const planStepSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  status: z.enum(["pending", "in_progress", "completed"]),
});
const registrationPlanSchema = z.object({
  title: z.string().min(1).max(120),
  steps: z.array(planStepSchema).min(2).max(8),
});
const requestSchema = z.object({
  messages: z.array(z.unknown()),
  initialPrompt: z.string().trim().min(1).max(2_000),
});
const generatedRouteSchema = z.object({
  businessLabel: z.string().min(1).max(100),
  registrationType: z.enum(["Sole proprietor", "Self-employed", "Company", "Needs review"]),
  category: z.enum([
    "professional-services",
    "retail",
    "food-service",
    "food-manufacturing",
    "vehicle-rental",
    "general-services",
  ]),
  flags: z.array(
    z.enum(["food", "food-manufacturing", "physical-premises", "vehicles", "employees"]),
  ),
  setup: z.array(z.string().max(100)).max(4),
  people: z.number().int().min(1).max(100_000),
});
const intakeDecisionSchema = z.object({
  status: z.enum(["question", "ready"]),
  question: questionSchema.nullable(),
  route: generatedRouteSchema.nullable(),
});
type GeneratedRoute = z.infer<typeof generatedRouteSchema>;

function userText(messages: UIMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .flatMap((message) =>
      message.parts.filter((part) => part.type === "text").map((part) => part.text),
    )
    .join("\n");
}

function businessAddressQuestion(city: string): IntakeQuestion {
  return {
    id: "business-address",
    eyebrow: "Last detail",
    title: `What is the business address in ${city}?`,
    helpText: "Include the street or building and barangay.",
    type: "text",
    placeholder: `Street or building, barangay, ${city}`,
  };
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

function toolAnswers(messages: UIMessage[]): IntakeAnswer[] {
  const answers = new Map<string, IntakeAnswer>();
  for (const message of messages)
    for (const part of message.parts) {
      if (part.type !== "tool-askUser" || part.state !== "output-available") continue;
      const input = part.input as { question: IntakeQuestion };
      const output = part.output as { value: string | string[]; labels: string[] };
      answers.set(input.question.id, {
        toolCallId: part.toolCallId,
        questionId: input.question.id,
        question: input.question.title,
        value: output.value,
        labels: output.labels,
      });
    }
  return [...answers.values()];
}

function lastRegistrationPlan(messages: UIMessage[]): RegistrationPlan | null {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (part.type === "tool-updatePlan" && part.state === "output-available")
        return (part.output as { plan: RegistrationPlan }).plan;
    }
  return null;
}

function normalizePlan(plan: RegistrationPlan): RegistrationPlan {
  let foundActive = false;
  return {
    title: plan.title,
    steps: plan.steps.map((step) => {
      if (step.status !== "in_progress") return step;
      if (foundActive) return { ...step, status: "pending" as const };
      foundActive = true;
      return step;
    }),
  };
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
  return normalizePlan({
    ...initialRegistrationPlan,
    steps: initialRegistrationPlan.steps.map((step) => ({
      ...step,
      status:
        step.id === "details"
          ? detailsComplete
            ? "completed"
            : "in_progress"
          : step.id === "official-check"
            ? hasSearched
              ? "completed"
              : detailsComplete
                ? "in_progress"
                : "pending"
            : step.id === "application"
              ? hasForm
                ? "completed"
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

function redactDtiFormForModel(form: DtiBusinessNameForm): DtiBusinessNameForm {
  return {
    ...form,
    ownerName: form.ownerName ? "[server-prefilled verified name]" : "",
    businessAddress: form.businessAddress ? "[server-confirmed business address]" : "",
  };
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
  const hasEmployees = labels.some(
    (label) => /yes|employee|worker/i.test(label) && !/no /i.test(label),
  );
  const hasPremises = labels.some((label) => /shop|office|commercial/i.test(label));
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
  const proposedName =
    answerText(answers, /proposed.*name|business.*name|trade.*name/i) ||
    proposedNameMatch?.[1]?.trim() ||
    "";
  const businessAddress = resolveBusinessFormAddress(
    extractExplicitBusinessAddress(prompt) ||
      answerText(answers, /business.*address|operating.*address|exact.*address/i),
    profile,
    usesProfileAddress,
  );
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

function repeatedQuestion(question: IntakeQuestion, answers: IntakeAnswer[]) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return answers.some(
    (answer) =>
      answer.questionId === question.id || normalize(answer.question) === normalize(question.title),
  );
}

async function decideIntake(prompt: string, city: string, answers: IntakeAnswer[]) {
  const inferred = inferCategory(prompt);
  const result = await generateObject({
    model: createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY! }).chat(
      process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite",
    ),
    schema: intakeDecisionSchema,
    system: `You are the intake router for Philippine business registration. Return one structured decision, not conversational prose.

Use the citizen's description and prior answers. Infer obvious facts instead of asking the citizen to classify the business. Ask exactly one question only when its answer can materially change the registration route, tax-office jurisdiction, permit path, or regulated-agency checks. Tailor it to this specific activity. Do not run a fixed questionnaire. Do not routinely ask about employees, premises, ownership, or address when those facts do not affect the path. Never repeat a known or answered fact. Never ask for a TIN or other sensitive identifier.

For a question, use a stable semantic kebab-case ID, short plain language, and the best input type. Choice questions need 2–6 complete options. Set route to null. If the registration path is already clear, return ready immediately, set question to null, and return the inferred route. One-owner trade-name, product, food, subscription, or rental activity is normally Sole proprietor. Independent professional work under the person's own name is normally Self-employed. Explicit partners or a corporation use Company. Do not ask the citizen to choose among these labels when the activity already makes it clear.`,
    prompt: `Business description and citizen updates:\n${prompt}\n\nResolved business city: ${city}\nCatalog hint: ${inferred.category}; ${inferred.flags.join(", ") || "no flags"}\nPrior structured answers: ${answers.length ? JSON.stringify(answers.map(({ questionId, question, labels }) => ({ questionId, question, labels }))) : "None"}`,
    abortSignal: AbortSignal.timeout(20_000),
  });
  const decision = result.object;
  if (
    decision.status === "question" &&
    decision.question &&
    !repeatedQuestion(decision.question, answers) &&
    !/\b(?:tin|taxpayer identification)\b/i.test(decision.question.title)
  )
    return decision;
  if (decision.status === "ready" && decision.route) return decision;
  throw new Error("The intake router returned an invalid or repeated decision");
}

function deterministicNext(
  prompt: string,
  profile: CitizenProfile | null,
  answers: IntakeAnswer[],
) {
  const location = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const preference = addressPreference(answers);
  if (
    !selectRdo(location, answers, `${prompt} ${profile?.barangay ?? ""}`) &&
    location.rdos.length > 1
  )
    return { question: locationQuestion(location.city, location.rdos) };
  const answered = new Set(answers.map((answer) => answer.questionId));
  const firstQuestion = fallbackQuestionFor(prompt, 0);
  if (!answered.has(firstQuestion.id)) return { question: firstQuestion };
  if (!answered.has("workers")) return { question: fallbackQuestionFor(prompt, 1) };
  if (!preference) return { question: profileAddressQuestion() };
  if (!answered.has("business-address") && preference === "different")
    return { question: businessAddressQuestion(location.city) };
  const plan = makePlan(prompt, profile, answers);
  if (plan.registrationType !== "Sole proprietor") return { plan };
  const proposedNameMatch = prompt.match(/(?:called|named|name is)\s+[“"]?([^.”"\n]+)/i);
  const businessAddress = resolveBusinessFormAddress(
    extractExplicitBusinessAddress(prompt) ||
      answers.find((answer) => answer.questionId === "business-address")?.labels.join(", ") ||
      "",
    profile,
    preference === "profile",
  );
  const missingFields = [
    ...(!proposedNameMatch ? ["Proposed business name"] : []),
    ...(!businessAddress ? ["Business address"] : []),
  ];
  const form: DtiBusinessNameForm = {
    applicationType: "New registration",
    status: missingFields.length ? "Draft" : "Ready to submit",
    proposedName: proposedNameMatch?.[1]?.trim() ?? "",
    businessActivity: prompt.slice(0, 160),
    territorialScope: "City / municipality",
    ownerName: profile?.fullName ?? "",
    businessAddress,
    city: plan.city,
    feeLabel: formatPeso(dtiRegistrationFee("City / municipality")),
    missingFields,
  };
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
  prompt: string,
  profile: CitizenProfile | null,
  userInfo: UserInfoOutput,
  businessCity: string,
  usesProfileAddress: boolean,
  confirmedBusinessAddress: string,
) {
  return {
    user_info: tool({
      description:
        "Report which verified eGov SSO fields are available for server-side form prefilling. Values remain private and are applied by form tools. Call this before preparing a form.",
      inputSchema: z.object({}),
      execute: () => userInfo,
    }),
    askUser: tool({
      description:
        "Ask one consequential structured question. This is a client-side tool. Stop after calling it.",
      inputSchema: z.object({ question: questionSchema }),
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
        "Create or revise the citizen's DTI Business Name Registration draft. Call this whenever the user asks to create, view, or correct the form.",
      inputSchema: z.object({ form: dtiFormSchema, note: z.string().max(180) }),
      execute: ({ form }) => {
        const businessAddress = resolveBusinessFormAddress(
          confirmedBusinessAddress,
          profile,
          usesProfileAddress,
        );
        const missingFields = [
          ...new Set([
            ...form.missingFields.filter((field) => !/owner|fee/i.test(field)),
            ...(!form.proposedName.trim() ? ["Proposed business name"] : []),
            ...(!businessAddress.trim() ? ["Business address"] : []),
          ]),
        ];
        return {
          form: {
            ...form,
            ownerName: profile?.fullName ?? form.ownerName,
            businessActivity: prompt.slice(0, 160),
            businessAddress,
            city: businessCity,
            feeLabel: formatPeso(dtiRegistrationFee(form.territorialScope)),
            missingFields,
            status: missingFields.length ? ("Draft" as const) : ("Ready to submit" as const),
          },
        };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          form: {
            ...output.form,
            ownerName: output.form.ownerName ? "[server-prefilled verified name]" : "",
            businessAddress: output.form.businessAddress
              ? "[server-confirmed business address]"
              : "",
          },
        },
      }),
    }),
    updatePlan: tool({
      description: "Create or update the concise registration checklist whenever progress changes.",
      inputSchema: registrationPlanSchema.extend({ note: z.string().max(180).optional() }),
      execute: (input) => ({ plan: normalizePlan({ title: input.title, steps: input.steps }) }),
    }),
  };
}

export async function POST(request: Request) {
  const session = readSession(request);
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const messages = parsed.data.messages as BusinessChatMessage[];
  const profile = session.profile;
  const userInfoOutput: UserInfoOutput = {
    availableFields: availableUserInfoFields(profile),
    source: "eGov SSO",
  };
  const conversationText = userText(messages).trim();
  const prompt = conversationText || parsed.data.initialPrompt;
  const answers = toolAnswers(messages);
  const preference = addressPreference(answers);
  const confirmedBusinessAddress =
    answerText(answers, /business.*address|operating.*address|exact.*address/i) ||
    extractExplicitBusinessAddress(prompt);
  const initialLocation = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const tools = agentTools(
    prompt,
    profile,
    userInfoOutput,
    initialLocation.city,
    preference === "profile",
    confirmedBusinessAddress,
  );
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
  const location = initialLocation;

  if (!process.env.AI_GATEWAY_API_KEY) {
    const next = deterministicNext(prompt, profile, answers);
    const stream = createUIMessageStream<BusinessChatMessage>({
      originalMessages: messages,
      execute: ({ writer }) => {
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        const text =
          "question" in next
            ? "I need one detail before I prepare your registration."
            : "I prepared the next step from the details you shared.";
        writer.write({ type: "text-delta", id: textId, delta: text });
        writer.write({ type: "text-end", id: textId });
        if ("question" in next)
          writer.write({
            type: "tool-input-available",
            toolCallId: crypto.randomUUID(),
            toolName: "askUser",
            input: { question: next.question },
          });
        else {
          if (next.form) {
            emitTool(writer, "user_info", {}, userInfoOutput);
            const id = crypto.randomUUID();
            writer.write({
              type: "tool-input-available",
              toolCallId: id,
              toolName: "editDtiBusinessNameForm",
              input: {
                form: redactDtiFormForModel(next.form),
                note: "Prepared from your profile and conversation.",
              },
            });
            writer.write({
              type: "tool-output-available",
              toolCallId: id,
              output: { form: next.form },
            });
          }
          writer.write({ type: "data-plan", id: crypto.randomUUID(), data: { plan: next.plan } });
        }
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  let generatedRoute: GeneratedRoute | undefined;
  if (!lastForm) {
    try {
      const decision = await decideIntake(prompt, location.city, answers);
      if (decision.status === "question" && decision.question) {
        const currentPlan = planForAnswers(answers, hasSearched, false, false);
        const stream = createUIMessageStream<BusinessChatMessage>({
          originalMessages: messages,
          execute: ({ writer }) => {
            if (!existingPlan || JSON.stringify(existingPlan) !== JSON.stringify(currentPlan))
              emitTool(
                writer,
                "updatePlan",
                { ...currentPlan, note: "Updated for the current registration step." },
                { plan: currentPlan },
              );
            const textId = crypto.randomUUID();
            writer.write({ type: "text-start", id: textId });
            writer.write({
              type: "text-delta",
              id: textId,
              delta: "One detail could change your registration path.",
            });
            writer.write({ type: "text-end", id: textId });
            writer.write({
              type: "tool-input-available",
              toolCallId: crypto.randomUUID(),
              toolName: "askUser",
              input: { question: decision.question },
            });
          },
        });
        return createUIMessageStreamResponse({ stream });
      }
      generatedRoute = decision.route ?? undefined;
    } catch (error) {
      console.warn("Business intake routing failed; using controlled fallback", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      const next = deterministicNext(prompt, profile, answers);
      if ("question" in next) {
        const fallbackPlan = planForAnswers(answers, hasSearched, false, false);
        const stream = createUIMessageStream<BusinessChatMessage>({
          originalMessages: messages,
          execute: ({ writer }) => {
            if (!existingPlan || JSON.stringify(existingPlan) !== JSON.stringify(fallbackPlan))
              emitTool(
                writer,
                "updatePlan",
                { ...fallbackPlan, note: "Updated for the current registration step." },
                { plan: fallbackPlan },
              );
            const textId = crypto.randomUUID();
            writer.write({ type: "text-start", id: textId });
            writer.write({
              type: "text-delta",
              id: textId,
              delta: "I need one detail before I continue.",
            });
            writer.write({ type: "text-end", id: textId });
            writer.write({
              type: "tool-input-available",
              toolCallId: crypto.randomUUID(),
              toolName: "askUser",
              input: { question: next.question },
            });
          },
        });
        return createUIMessageStreamResponse({ stream });
      }
    }
  }

  const businessPlan = makePlan(prompt, profile, answers, generatedRoute);
  const currentPlan = planForAnswers(answers, hasSearched, Boolean(lastForm), true);

  const requiredAddressQuestion = confirmedBusinessAddress
    ? null
    : !profile.address.trim()
      ? businessAddressQuestion(location.city)
      : !preference
        ? profileAddressQuestion()
        : preference === "different"
          ? businessAddressQuestion(location.city)
          : null;
  if (!lastForm && businessPlan.registrationType === "Sole proprietor" && requiredAddressQuestion) {
    const stream = createUIMessageStream<BusinessChatMessage>({
      originalMessages: messages,
      execute: ({ writer }) => {
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: "I need one address choice before I prepare the application.",
        });
        writer.write({ type: "text-end", id: textId });
        writer.write({
          type: "tool-input-available",
          toolCallId: crypto.randomUUID(),
          toolName: "askUser",
          input: { question: requiredAddressQuestion },
        });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  if (!hasSearched && !lastForm && businessPlan.registrationType === "Sole proprietor") {
    const form = makeDtiForm(
      parsed.data.initialPrompt,
      prompt,
      profile,
      answers,
      businessPlan,
      preference === "profile",
    );
    const stream = createUIMessageStream<BusinessChatMessage>({
      originalMessages: messages,
      execute: async ({ writer }) => {
        if (!hasUserInfo) emitTool(writer, "user_info", {}, userInfoOutput);
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
        writer.write({
          type: "tool-input-available",
          toolCallId: formId,
          toolName: "editDtiBusinessNameForm",
          input: {
            form: redactDtiFormForModel(form),
            note: "Prepared from your profile and confirmed answers.",
          },
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
          delta: form.missingFields.length
            ? "I prepared your DTI business name application. Add the missing fields or correct anything here before payment."
            : "Your DTI business name application is ready to review. You can correct any field here before continuing to eGovPay.",
        });
        writer.write({ type: "text-end", id: textId });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  const model = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY }).chat(
    process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite",
  );
  const result = streamText({
    model,
    tools,
    activeTools: ["user_info", "webSearch", "editDtiBusinessNameForm", "updatePlan"],
    stopWhen: stepCountIs(4),
    system: `You guide a Filipino citizen through business registration in a human-in-the-loop chat. Be concise, warm, and factual. Prefer short paragraphs and lists. Use a markdown table only when comparing three or more records; never use a table for a two-column field/value summary.

Intake questions are handled by the API router before this response. Never call askUser. Never print A/B/C choices in prose. Never ask users to provide a TIN.

Use updatePlan whenever registration progress changes. Keep 3–6 concise steps, preserve stable step IDs, mark finished work completed, and keep at most one step in_progress. The current plan is ${JSON.stringify(existingPlan ?? currentPlan)}.

The user_info tool returns JSON metadata listing which authenticated eGov SSO fields are available for server-side form prefilling; it never returns the field values to the model. It is ${hasUserInfo ? "already loaded in this conversation" : "not loaded yet"}. Before creating or editing any government form, call user_info first if it has not been loaded. Form tools apply matching verified values on the server, so do not ask for information that is already available unless explicit consent or a business-specific value is required.

The verified residential address may prefill the business address only after the dedicated structured profile-address choice is answered with use-profile-address. Otherwise use only the business address captured by the structured address question; never copy an address from model-generated tool input.

The resolved business city is ${location.city}. Explicit locations override the profile. The minimum intake is clear. The resolved route is ${JSON.stringify(businessPlan)}.

For a sole proprietor, create or update a DTI Business Name Registration draft with editDtiBusinessNameForm. DTI handles sole-proprietor business-name registration; do not call it a BIR form. The server applies verified identity and confirmed address values after the tool call, so use placeholders for those fields and never request or repeat their values. Never invent an address or fee. Use the official DTI territorial-scope fee plus documentary stamp supplied by the application; never invent a fee. The citizen may correct non-sensitive fields in ordinary chat; an address correction is accepted only when the server parses it directly from the citizen's message. Current redacted form: ${JSON.stringify(lastForm ? redactDtiFormForModel(lastForm) : null)}.

Use webSearch only when new current evidence is useful. Cite only returned official links. Never expose private reasoning. Do not claim submission or payment occurred.`,
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    timeout: { totalMs: 35_000, toolMs: 10_000 },
  });
  return result.toUIMessageStreamResponse({ originalMessages: messages, sendReasoning: false });
}
