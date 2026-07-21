import { createMCPClient } from "@ai-sdk/mcp";
import {
  convertToModelMessages,
  createGateway,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { fallbackQuestionFor, inferCategory } from "@/lib/business-rules";
import { buildRationale, citationsForPlan, locationQuestion, resolveBusinessLocation, selectRdo } from "@/lib/government-data";
import type { BusinessChatMessage, DtiBusinessNameForm, RegistrationPlan } from "@/lib/business-chat";
import { initialRegistrationPlan } from "@/lib/registration-plan";
import { dtiRegistrationFee, formatPeso } from "@/lib/dti-fees";
import type { CitizenProfile } from "@/lib/mock-data";
import type { BusinessPlan, IntakeAnswer, IntakeQuestion } from "@/lib/questions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const optionSchema = z.object({ id: z.string(), label: z.string(), description: z.string().optional(), icon: z.enum(["store", "laptop", "coffee", "home", "pin", "calendar"]).optional() });
const questionSchema = z.object({ id: z.string(), eyebrow: z.string(), title: z.string(), helpText: z.string(), type: z.enum(["single", "multi", "number", "text"]), options: z.array(optionSchema).optional(), placeholder: z.string().optional(), suffix: z.string().optional(), minimum: z.number().optional(), maximum: z.number().optional() });
const dtiFormSchema = z.object({ applicationType: z.literal("New registration"), status: z.enum(["Draft", "Ready to submit", "Submitted"]), proposedName: z.string(), businessActivity: z.string(), territorialScope: z.enum(["Barangay", "City / municipality", "Regional", "National"]), ownerName: z.string(), businessAddress: z.string(), city: z.string(), feeLabel: z.string(), missingFields: z.array(z.string()) });
const planStepSchema = z.object({ id: z.string().min(1).max(60), label: z.string().min(1).max(120), status: z.enum(["pending", "in_progress", "completed"]) });
const registrationPlanSchema = z.object({ title: z.string().min(1).max(120), steps: z.array(planStepSchema).min(2).max(8) });
const profileSchema = z.object({ firstName: z.string(), fullName: z.string(), mobile: z.string(), address: z.string(), city: z.string(), barangay: z.string(), tinMasked: z.string(), rdo: z.string(), avatarUrl: z.string() });
const requestSchema = z.object({ messages: z.array(z.unknown()), profile: profileSchema.nullable(), initialPrompt: z.string().trim().min(1).max(2_000) });

function userText(messages: UIMessage[]) {
  return messages.filter((message) => message.role === "user").flatMap((message) => message.parts.filter((part) => part.type === "text").map((part) => part.text)).join("\n");
}

function businessAddressQuestion(city: string): IntakeQuestion {
  return { id: "business-address", eyebrow: "Last detail", title: `What is the business address in ${city}?`, helpText: "Include the street or building and barangay.", type: "text", placeholder: `Street or building, barangay, ${city}` };
}

function toolAnswers(messages: UIMessage[]): IntakeAnswer[] {
  const answers = new Map<string, IntakeAnswer>();
  for (const message of messages) for (const part of message.parts) {
    if (part.type !== "tool-askUser" || part.state !== "output-available") continue;
    const input = part.input as { question: IntakeQuestion };
    const output = part.output as { value: string | string[]; labels: string[] };
    answers.set(input.question.id, { toolCallId: part.toolCallId, questionId: input.question.id, question: input.question.title, value: output.value, labels: output.labels });
  }
  return [...answers.values()];
}

function lastRegistrationPlan(messages: UIMessage[]): RegistrationPlan | null {
  for (const message of [...messages].reverse()) for (const part of [...message.parts].reverse()) {
    if (part.type === "tool-updatePlan" && part.state === "output-available") return (part.output as { plan: RegistrationPlan }).plan;
  }
  return null;
}

function normalizePlan(plan: RegistrationPlan): RegistrationPlan {
  let foundActive = false;
  return { title: plan.title, steps: plan.steps.map((step) => {
    if (step.status !== "in_progress") return step;
    if (foundActive) return { ...step, status: "pending" as const };
    foundActive = true;
    return step;
  }) };
}

function emitTool(writer: Parameters<Parameters<typeof createUIMessageStream<BusinessChatMessage>>[0]["execute"]>[0]["writer"], toolName: string, input: unknown, output: unknown) {
  const toolCallId = crypto.randomUUID();
  writer.write({ type: "tool-input-available", toolCallId, toolName, input } as never);
  writer.write({ type: "tool-output-available", toolCallId, output } as never);
}

function planForAnswers(answers: IntakeAnswer[], hasSearched: boolean, hasForm: boolean) {
  const answerIds = new Set(answers.map((answer) => answer.questionId));
  const detailsComplete = answerIds.has("workers") && answerIds.has("business-address") && answers.length >= 3;
  return normalizePlan({ ...initialRegistrationPlan, steps: initialRegistrationPlan.steps.map((step) => ({ ...step, status:
    step.id === "details" ? (detailsComplete ? "completed" : "in_progress") :
    step.id === "official-check" ? (hasSearched ? "completed" : detailsComplete ? "in_progress" : "pending") :
    step.id === "application" ? (hasForm ? "completed" : hasSearched ? "in_progress" : "pending") : "pending",
  })) });
}

function lastDtiForm(messages: UIMessage[]) {
  for (const message of [...messages].reverse()) for (const part of [...message.parts].reverse()) {
    if (part.type === "tool-editDtiBusinessNameForm" && part.state === "output-available") return (part.output as { form: DtiBusinessNameForm }).form;
  }
  return null;
}

function makePlan(prompt: string, profile: CitizenProfile | null, answers: IntakeAnswer[]): BusinessPlan {
  const inferred = inferCategory(prompt);
  const location = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const rdo = selectRdo(location, answers, `${prompt} ${profile?.barangay ?? ""}`);
  const labels = answers.flatMap((answer) => answer.labels);
  const hasEmployees = labels.some((label) => /yes|employee|worker/i.test(label) && !/no /i.test(label));
  const hasPremises = labels.some((label) => /shop|office|commercial/i.test(label));
  const flags = [...new Set([...inferred.flags, ...(hasPremises ? ["physical-premises" as const] : []), ...(hasEmployees ? ["employees" as const] : [])])];
  const registrationType = inferred.category === "professional-services" ? "Self-employed" as const : "Sole proprietor" as const;
  const businessLabel = inferred.category === "professional-services" ? "Professional services" : inferred.category === "vehicle-rental" ? "Vehicle rental business" : inferred.category.startsWith("food") ? "Food business" : "New business";
  return { businessLabel, registrationType, city: location.city, setup: labels.slice(0, 4), people: hasEmployees ? 2 : 1, category: inferred.category, flags, rdo, rationale: buildRationale(registrationType, inferred.category, location.city, rdo, flags, profile?.rdo), citations: citationsForPlan(registrationType, flags) };
}

function deterministicNext(prompt: string, profile: CitizenProfile | null, answers: IntakeAnswer[]) {
  const location = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  if (!selectRdo(location, answers, `${prompt} ${profile?.barangay ?? ""}`) && location.rdos.length > 1) return { question: locationQuestion(location.city, location.rdos) };
  const answered = new Set(answers.map((answer) => answer.questionId));
  const firstQuestion = fallbackQuestionFor(prompt, 0);
  if (!answered.has(firstQuestion.id)) return { question: firstQuestion };
  if (!answered.has("workers")) return { question: fallbackQuestionFor(prompt, 1) };
  if (!answered.has("business-address")) return { question: businessAddressQuestion(location.city) };
  const plan = makePlan(prompt, profile, answers);
  if (plan.registrationType !== "Sole proprietor") return { plan };
  const proposedNameMatch = prompt.match(/(?:called|named|name is)\s+[“"]?([^.”"\n]+)/i);
  const form: DtiBusinessNameForm = {
    applicationType: "New registration",
    status: proposedNameMatch ? "Ready to submit" : "Draft",
    proposedName: proposedNameMatch?.[1]?.trim() ?? "",
    businessActivity: prompt.slice(0, 160),
    territorialScope: "City / municipality",
    ownerName: profile?.fullName ?? "",
    businessAddress: answers.find((answer) => answer.questionId === "business-address")?.labels.join(", ") ?? "",
    city: plan.city,
    feeLabel: formatPeso(dtiRegistrationFee("City / municipality")),
    missingFields: proposedNameMatch ? [] : ["Proposed business name"],
  };
  return { plan, form };
}

async function searchOfficialWeb(query: string, numResults = 5) {
  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  try {
    client = await createMCPClient({ transport: { type: "http", url: "https://mcp.exa.ai/mcp?tools=web_search_exa", redirect: "follow", ...(process.env.EXA_API_KEY ? { headers: { "x-api-key": process.env.EXA_API_KEY } } : {}) } });
    const result = await client.callTool({ name: "web_search_exa", arguments: { query, numResults }, options: { timeout: 8_000 } });
    const text = JSON.stringify(result);
    const results: { title: string; url: string }[] = [];
    for (const match of text.matchAll(/Title:\\?n?([^"\\]+).*?URL:\\?n?(https?:\\?\/\\?\/[^"\\\s]+)/gi)) {
      const url = match[2].replaceAll("\\/", "/");
      if (/\.gov\.ph\b|bir\.gov\.ph\b|dti\.gov\.ph\b/i.test(url)) results.push({ title: match[1].trim(), url });
    }
    return { results: results.slice(0, 5) };
  } catch { return { results: [] }; } finally { await client?.close(); }
}

function agentTools(prompt: string, profile: CitizenProfile | null, businessCity: string, usesProfileAddress: boolean) {
  return {
    askUser: tool({ description: "Ask one consequential structured question. This is a client-side tool. Stop after calling it.", inputSchema: z.object({ question: questionSchema }) }),
    webSearch: tool({ description: "Search official Philippine government sources when current evidence is useful.", inputSchema: z.object({ query: z.string().min(5).max(180), numResults: z.number().int().min(1).max(6).default(5) }), execute: ({ query, numResults }) => searchOfficialWeb(query, numResults) }),
    editDtiBusinessNameForm: tool({ description: "Create or revise the citizen's DTI Business Name Registration draft. Call this whenever the user asks to create, view, or correct the form.", inputSchema: z.object({ form: dtiFormSchema, note: z.string().max(180) }), execute: ({ form }) => {
      const businessAddress = usesProfileAddress ? profile?.address ?? form.businessAddress : form.businessAddress === businessCity ? "" : form.businessAddress;
      const missingFields = [...new Set([
        ...form.missingFields.filter((field) => !/owner|fee/i.test(field)),
        ...(!form.proposedName.trim() ? ["Proposed business name"] : []),
        ...(!businessAddress.trim() ? ["Business address"] : []),
      ])];
      return { form: { ...form, ownerName: profile?.fullName ?? form.ownerName, businessActivity: prompt.slice(0, 160), businessAddress, city: businessCity, feeLabel: formatPeso(dtiRegistrationFee(form.territorialScope)), missingFields, status: missingFields.length ? "Draft" as const : "Ready to submit" as const } };
    } }),
    updatePlan: tool({ description: "Create or update the concise registration checklist whenever progress changes.", inputSchema: registrationPlanSchema.extend({ note: z.string().max(180).optional() }), execute: (input) => ({ plan: normalizePlan({ title: input.title, steps: input.steps }) }) }),
  };
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const messages = parsed.data.messages as BusinessChatMessage[];
  const profile = parsed.data.profile;
  const prompt = `${parsed.data.initialPrompt}\n${userText(messages)}`;
  const answers = toolAnswers(messages);
  const initialLocation = resolveBusinessLocation(prompt, profile?.city ?? "Philippines", answers);
  const tools = agentTools(prompt, profile, initialLocation.city, initialLocation.source === "profile");
  const existingPlan = lastRegistrationPlan(messages);
  const hasSearched = messages.some((message) => message.parts.some((part) => part.type === "tool-webSearch" && part.state === "output-available"));
  const lastForm = lastDtiForm(messages);
  const location = initialLocation;
  const answered = new Set(answers.map((answer) => answer.questionId));
  const firstQuestion = fallbackQuestionFor(prompt, 0);
  const deterministicQuestion = (!selectRdo(location, answers, `${prompt} ${profile?.barangay ?? ""}`) && location.rdos.length > 1 && !answered.has("business-area")) ? locationQuestion(location.city, location.rdos) : !answered.has(firstQuestion.id) ? firstQuestion : !answered.has("workers") ? fallbackQuestionFor(prompt, 1) : !answered.has("business-address") ? businessAddressQuestion(location.city) : null;
  const currentPlan = planForAnswers(answers, hasSearched, Boolean(lastForm));

  // HITL is a hard server boundary: emit one question and close the turn.
  if (deterministicQuestion) {
    const stream = createUIMessageStream<BusinessChatMessage>({ originalMessages: messages, execute: ({ writer }) => {
      emitTool(writer, "updatePlan", { ...currentPlan, note: "Registration details are ready." }, { plan: currentPlan });
      if (!existingPlan || JSON.stringify(existingPlan) !== JSON.stringify(currentPlan)) emitTool(writer, "updatePlan", { ...currentPlan, note: "Updated for the current registration step." }, { plan: currentPlan });
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: "I need one detail before I continue." });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "tool-input-available", toolCallId: crypto.randomUUID(), toolName: "askUser", input: { question: deterministicQuestion } });
    } });
    return createUIMessageStreamResponse({ stream });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    const next = deterministicNext(prompt, profile, answers);
    const stream = createUIMessageStream<BusinessChatMessage>({ originalMessages: messages, execute: ({ writer }) => {
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      const text = "question" in next ? "I need one detail before I prepare your registration." : "I prepared the next step from the details you shared.";
      writer.write({ type: "text-delta", id: textId, delta: text }); writer.write({ type: "text-end", id: textId });
      if ("question" in next) writer.write({ type: "tool-input-available", toolCallId: crypto.randomUUID(), toolName: "askUser", input: { question: next.question } });
      else {
        if (next.form) { const id = crypto.randomUUID(); writer.write({ type: "tool-input-available", toolCallId: id, toolName: "editDtiBusinessNameForm", input: { form: next.form, note: "Prepared from your profile and conversation." } }); writer.write({ type: "tool-output-available", toolCallId: id, output: { form: next.form } }); }
        writer.write({ type: "data-plan", id: crypto.randomUUID(), data: { plan: next.plan } });
      }
    } });
    return createUIMessageStreamResponse({ stream });
  }

  if (!hasSearched && !lastForm) {
    const next = deterministicNext(prompt, profile, answers);
    if (!("form" in next) || !next.form) return Response.json({ error: "The application is not ready." }, { status: 409 });
    const stream = createUIMessageStream<BusinessChatMessage>({ originalMessages: messages, execute: async ({ writer }) => {
      emitTool(writer, "updatePlan", { ...currentPlan, note: "Checking current DTI guidance." }, { plan: currentPlan });
      const query = `site:dti.gov.ph OR site:bnrs.dti.gov.ph business name registration ${next.form.territorialScope}`;
      const searchId = crypto.randomUUID();
      writer.write({ type: "tool-input-available", toolCallId: searchId, toolName: "webSearch", input: { query, numResults: 5 } });
      const search = await searchOfficialWeb(query, 5);
      writer.write({ type: "tool-output-available", toolCallId: searchId, output: search });
      const afterSearch = planForAnswers(answers, true, false);
      emitTool(writer, "updatePlan", { ...afterSearch, note: "Official guidance checked. Preparing the application." }, { plan: afterSearch });
      const formId = crypto.randomUUID();
      writer.write({ type: "tool-input-available", toolCallId: formId, toolName: "editDtiBusinessNameForm", input: { form: next.form, note: "Prepared from your profile and confirmed answers." } });
      writer.write({ type: "tool-output-available", toolCallId: formId, output: { form: next.form } });
      const readyPlan = planForAnswers(answers, true, true);
      emitTool(writer, "updatePlan", { ...readyPlan, note: "The DTI application is ready for review." }, { plan: readyPlan });
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: "Your DTI business name application is ready to review. You can correct any field here before continuing to eGovPay." });
      writer.write({ type: "text-end", id: textId });
    } });
    return createUIMessageStreamResponse({ stream });
  }

  const model = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY }).chat(process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite");
  const result = streamText({
    model, tools, activeTools: ["webSearch", "editDtiBusinessNameForm", "updatePlan"], stopWhen: stepCountIs(4),
    system: `You guide a Filipino citizen through business registration in a human-in-the-loop chat. Be concise, warm, and factual.

Questions are controlled outside this model loop. Never call askUser. Never print A/B/C choices in prose. Never ask users to provide a TIN.

Use updatePlan whenever registration progress changes. Keep 3–6 concise steps, preserve stable step IDs, mark finished work completed, and keep at most one step in_progress. The current plan is ${JSON.stringify(existingPlan ?? currentPlan)}.

The resolved business city is ${location.city}. Explicit locations override the profile. ${deterministicQuestion ? `The next useful question is ${JSON.stringify(deterministicQuestion)}. Call askUser with exactly this question, then stop.` : "The minimum intake is clear."}

For a sole proprietor, create or update a DTI Business Name Registration draft with editDtiBusinessNameForm. DTI handles sole-proprietor business-name registration; do not call it a BIR form. Preserve known fields and copy the exact profile owner name. Never invent an address or fee. If the business city differs from the profile city and no full business address was supplied, leave the address blank and list Business address under missingFields. Use the official DTI territorial-scope fee plus documentary stamp supplied by the application; never invent a fee. The citizen may correct any field in ordinary chat; apply the correction by calling editDtiBusinessNameForm with the full revised form. Current form: ${JSON.stringify(lastForm)}.

Use webSearch only when new current evidence is useful. Cite only returned official links. Never expose private reasoning. Do not claim submission or payment occurred.`,
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    timeout: { totalMs: 35_000, toolMs: 10_000 },
  });
  return result.toUIMessageStreamResponse({ originalMessages: messages, sendReasoning: false });
}
