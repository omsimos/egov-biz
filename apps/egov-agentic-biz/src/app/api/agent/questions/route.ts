import { createMCPClient } from "@ai-sdk/mcp";
import { createGateway, generateObject, generateText, stepCountIs } from "ai";
import { z } from "zod";
import { fallbackQuestionFor, inferCategory, type RegulatoryFlag } from "@/lib/business-rules";
import {
  buildRationale,
  citationsForPlan,
  locationQuestion,
  resolveBusinessLocation,
  selectRdo,
} from "@/lib/government-data";
import type { BusinessPlan, IntakeAnswer } from "@/lib/questions";
import type { PlanCitation } from "@/lib/questions";

export const dynamic = "force-dynamic";

const optionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  icon: z.enum(["store", "laptop", "coffee", "home", "pin", "calendar"]).optional(),
});

const questionSchema = z.object({
  id: z.string(),
  eyebrow: z.string(),
  title: z.string(),
  helpText: z.string(),
  type: z.enum(["single", "multi", "number", "text"]),
  options: z.array(optionSchema).optional(),
  placeholder: z.string().optional(),
  suffix: z.string().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
});

const generatedPlanSchema = z.object({
  businessLabel: z.string(),
  registrationType: z.enum(["Sole proprietor", "Self-employed", "Company", "Needs review"]),
  setup: z.array(z.string()).max(4),
  people: z.number().int().min(1),
  category: z.enum(["professional-services", "retail", "food-service", "food-manufacturing", "vehicle-rental", "general-services"]),
  flags: z.array(z.enum(["food", "food-manufacturing", "physical-premises", "vehicles", "employees"])),
});

const responseSchema = z.object({
  status: z.enum(["question", "ready"]),
  question: questionSchema.nullable(),
  plan: generatedPlanSchema.nullable(),
});

type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
type RequestBody = {
  prompt?: string;
  profileCity?: string;
  city?: string;
  profileBarangay?: string;
  profileRdo?: string;
  answers?: IntakeAnswer[];
};

async function researchWithExa(plan: GeneratedPlan, city: string) {
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
    const tools = await client.tools({
      schemas: {
        web_search_exa: {
          inputSchema: z.object({
            query: z.string(),
            numResults: z.number().optional(),
          }),
        },
      },
    });
    const result = await generateText({
      model: createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY }).chat(process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite"),
      tools,
      toolChoice: { type: "tool", toolName: "web_search_exa" },
      stopWhen: stepCountIs(2),
      timeout: { totalMs: 12_000, toolMs: 8_000 },
      system: "Use Exa to find current official Philippine government sources. Search only for evidence; never provide citizen-facing prose.",
      prompt: `Find official Philippine government pages supporting the registration route for a ${plan.registrationType} ${plan.category} business in ${city}. Include BIR RDO jurisdiction and relevant DTI or SEC, LGU, FDA, BFP, LTO, or employer requirements. Prefer .gov.ph sources.`,
    });
    const strings: string[] = [];
    const visit = (value: unknown) => {
      if (typeof value === "string") strings.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit(result.steps.flatMap((step) => step.toolResults));
    const citations: PlanCitation[] = [];
    for (const text of strings) {
      for (const match of text.matchAll(/Title:\s*(.+?)\nURL:\s*(https?:\/\/[^\s]+)/g)) {
        const title = match[1].trim();
        const url = match[2].trim();
        if (!/\.gov\.ph\b|bir\.gov\.ph\b|bfp\.gov\.ph\b/i.test(url)) continue;
        const host = new URL(url).hostname.replace(/^www\./, "");
        citations.push({ id: `exa-${citations.length + 1}`, title, agency: host, url, note: "Official source found for this plan." });
      }
    }
    return citations.filter((citation, index) => citations.findIndex((item) => item.url === citation.url) === index).slice(0, 5);
  } catch (error) {
    console.warn("Exa MCP research unavailable", error);
    return [] as PlanCitation[];
  } finally {
    await client?.close();
  }
}

function enrichPlan(generated: GeneratedPlan, body: RequestBody, answers: IntakeAnswer[]): BusinessPlan {
  const profileCity = body.profileCity ?? body.city ?? "Philippines";
  const location = resolveBusinessLocation(body.prompt ?? "", profileCity, answers);
  const rdo = selectRdo(location, answers, `${body.prompt ?? ""} ${body.profileBarangay ?? ""}`);
  const flags = [...new Set([...inferCategory(body.prompt ?? "").flags, ...generated.flags])] as RegulatoryFlag[];
  return {
    ...generated,
    city: location.city,
    flags,
    rdo,
    rationale: buildRationale(generated.registrationType, generated.category, location.city, rdo, flags, body.profileRdo),
    citations: citationsForPlan(generated.registrationType, flags),
  };
}

function fallbackDecision(body: RequestBody, answers: IntakeAnswer[]) {
  const prompt = body.prompt ?? "";
  const profileCity = body.profileCity ?? body.city ?? "Philippines";
  const location = resolveBusinessLocation(prompt, profileCity, answers);
  const rdo = selectRdo(location, answers, `${prompt} ${body.profileBarangay ?? ""}`);
  if (!rdo && location.rdos.length > 1) {
    return { status: "question" as const, question: locationQuestion(location.city, location.rdos), source: "catalog" };
  }
  const inferred = inferCategory(prompt);
  if (answers.filter((answer) => answer.questionId !== "business-area").length < 2) {
    return { status: "question" as const, question: fallbackQuestionFor(prompt, answers.filter((answer) => answer.questionId !== "business-area").length), source: "prototype-fallback" };
  }
  const labels = answers.flatMap((answer) => answer.labels);
  const hasEmployees = labels.some((label) => /yes|employee|worker/i.test(label) && !/no /i.test(label));
  const hasPremises = labels.some((label) => /shop|office|commercial/i.test(label));
  const flags = [...new Set([...inferred.flags, ...(hasPremises ? ["physical-premises" as const] : []), ...(hasEmployees ? ["employees" as const] : [])])];
  const generated: GeneratedPlan = {
    businessLabel: inferred.category === "professional-services" ? "Professional services" : inferred.category === "vehicle-rental" ? "Vehicle rental business" : inferred.category.startsWith("food") ? "Food business" : "New business",
    registrationType: inferred.category === "professional-services" ? "Self-employed" : "Sole proprietor",
    setup: labels.slice(0, 4),
    people: hasEmployees ? 2 : 1,
    category: inferred.category,
    flags,
  };
  return { status: "ready" as const, plan: enrichPlan(generated, body, answers), source: "prototype-fallback" };
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const prompt = body.prompt?.trim();
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 6) : [];
  if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });
  body.prompt = prompt;

  const profileCity = body.profileCity ?? body.city ?? "Philippines";
  const location = resolveBusinessLocation(prompt, profileCity, answers);
  const selectedRdo = selectRdo(location, answers, `${prompt} ${body.profileBarangay ?? ""}`);
  if (!selectedRdo && location.rdos.length > 1) {
    return Response.json({ status: "question", question: locationQuestion(location.city, location.rdos), source: "catalog" });
  }
  if (!process.env.AI_GATEWAY_API_KEY || answers.length >= 6) return Response.json(fallbackDecision(body, answers));

  const inferred = inferCategory(prompt);
  try {
    const result = await generateObject({
      model: createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY }).chat(process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite"),
      schema: responseSchema,
      system: `You guide Filipino citizens through Philippine business registration. Ask exactly one useful question or return ready.

Infer the route from the activity. Independent professional work under the person's own name is usually Self-employed. A one-owner product, food, subscription, rental, or trade-name business is usually a Sole proprietor. Partnerships and corporations use Company. Never ask users to classify themselves when the activity is clear.

The resolved business city is ${location.city}; it came from the ${location.source}. An explicit city in the business description overrides the profile city. The applicable tax office is based on BIR jurisdiction, not physical distance. Do not ask about the RDO; the service has resolved it separately.

Ask only facts that can change registration, permits, tax treatment, or regulated-agency checks. For vehicle rental, distinguish self-drive from rental with a driver. For food, clarify where and by whom it is prepared. Do not repeat answered facts. Keep titles under 12 words and help text to one short sentence. Never ask for a TIN. Return ready as soon as essentials are clear. Always return status, question, and plan; set the unused field to null.`,
      prompt: `Business description: ${prompt}\nCatalog category: ${inferred.category}\nCatalog flags: ${inferred.flags.join(", ") || "none"}\nAnswers: ${answers.length ? JSON.stringify(answers) : "None"}`,
    });

    if (result.object.status === "question" && result.object.question) {
      const asksForObviousStructure = /structure|sole proprietor|self-employed|type of registration|owned by one person|one person or multiple|how many owners|who will own|alone or with partners|operating.*partners/i.test(result.object.question.title);
      const partnerIsUnclear = /partner|co-owner|corporation|company with/i.test(prompt);
      if (asksForObviousStructure && !partnerIsUnclear && inferred.category !== "general-services") return Response.json(fallbackDecision(body, answers));
      return Response.json({ status: "question", question: result.object.question, source: "vercel-ai-gateway" });
    }
    if (result.object.status === "ready" && result.object.plan) {
      const plan = enrichPlan(result.object.plan, body, answers);
      const researchedSources = await researchWithExa(result.object.plan, plan.city);
      plan.citations = [...plan.citations, ...researchedSources]
        .filter((citation, index, all) => all.findIndex((item) => item.url === citation.url) === index)
        .slice(0, 8);
      return Response.json({ status: "ready", plan, source: "vercel-ai-gateway", research: { provider: "exa-mcp", officialSourcesFound: researchedSources.length } });
    }
    throw new Error("Gateway returned an incomplete decision");
  } catch (error) {
    console.error("Question generation failed", error);
    return Response.json(fallbackDecision(body, answers));
  }
}
