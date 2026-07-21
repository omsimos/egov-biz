import { createGateway, generateObject } from "ai";
import { z } from "zod";
import { fallbackQuestionFor, inferCategory } from "@/lib/business-rules";
import type { IntakeAnswer } from "@/lib/questions";

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

const planSchema = z.object({
  businessLabel: z.string(),
  registrationType: z.enum(["Sole proprietor", "Self-employed", "Company", "Needs review"]),
  city: z.string(),
  setup: z.array(z.string()).max(4),
  people: z.number().int().min(1),
  category: z.enum(["professional-services", "retail", "food-service", "food-manufacturing", "vehicle-rental", "general-services"]),
  flags: z.array(z.enum(["food", "food-manufacturing", "physical-premises", "vehicles", "employees"])),
});

// A flat shape is more reliable across Gateway models than a JSON Schema union.
const responseSchema = z.object({
  status: z.enum(["question", "ready"]),
  question: questionSchema.nullable(),
  plan: planSchema.nullable(),
});

type RequestBody = {
  prompt?: string;
  city?: string;
  answers?: IntakeAnswer[];
};

function fallbackDecision(prompt: string, city: string, answers: IntakeAnswer[]) {
  const inferred = inferCategory(prompt);
  if (answers.length < 2) {
    return { status: "question" as const, question: fallbackQuestionFor(prompt, answers.length), source: "prototype-fallback" };
  }
  const labels = answers.flatMap((answer) => answer.labels);
  const hasEmployees = labels.some((label) => /yes|employee|worker/i.test(label) && !/no /i.test(label));
  const hasPremises = labels.some((label) => /shop|office|commercial/i.test(label));
  return {
    status: "ready" as const,
    plan: {
      businessLabel: inferred.category === "professional-services" ? "Professional services" : inferred.category === "vehicle-rental" ? "Vehicle rental business" : inferred.category.startsWith("food") ? "Food business" : "New business",
      registrationType: inferred.category === "professional-services" ? "Self-employed" as const : "Sole proprietor" as const,
      city,
      setup: labels.slice(0, 4),
      people: hasEmployees ? 2 : 1,
      category: inferred.category,
      flags: [...inferred.flags, ...(hasPremises ? ["physical-premises" as const] : []), ...(hasEmployees ? ["employees" as const] : [])],
    },
    source: "prototype-fallback",
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const prompt = body.prompt?.trim();
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 6) : [];

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const inferred = inferCategory(prompt);

  if (answers.length >= 6) {
    return Response.json({
      status: "ready",
      plan: { businessLabel: "New business", registrationType: "Needs review", city: body.city ?? "Philippines", setup: [], people: 1, category: "general-services", flags: [] },
      source: "limit",
    });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(fallbackDecision(prompt, body.city ?? "Philippines", answers));
  }

  try {
    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
    const model = gateway.chat(process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite");
    const result = await generateObject({
      model,
      schema: responseSchema,
      system: `You guide Filipino citizens through business registration.

Decide whether you have enough information to prepare the correct government path. If not, ask exactly one next-best question. After the citizen answers, you will receive the full history and reassess.

You usually need to know:
- what they will sell or do;
- whether they will operate alone, freelance under their name, or have partners;
- where and how they will operate, only when it affects permits;
- whether they will hire workers;
- regulated activities, expected income, or timing only when relevant.

Classification rules:
- Infer the likely route from the activity. Do not ask the citizen whether they are a sole proprietor or self-employed when the description makes it clear.
- A person offering independent professional services under their own name is usually Self-employed.
- A person selling goods, food, subscriptions, rentals, or operating under a trade name alone is usually a Sole proprietor.
- If one person says “I want to start” a product or rental business and does not mention partners, use Sole proprietor. Do not ask them to choose a structure.
- Partners or a separate legal entity may require Company or Needs review.
- Coffee subscriptions and product businesses are not freelance professional work.
- Flag food for prepared or handled food; food-manufacturing for packaged, bottled, processed, or manufactured food; vehicles for car or vehicle rental; physical-premises for shops, offices, kitchens, or customer locations; employees when workers will be hired.
- For vehicle rental, distinguish self-drive from rental with driver because transport requirements may differ.
- For food, clarify where and by whom it is prepared if not clear.

Rules:
- Never ask for information already clear from the initial statement, profile city, or earlier answers.
- Ask only questions that can change requirements, tax registration, permits, or the recommended route.
- Prefer single-choice or multi-select. Use number only when a number matters. Use text only when choices would be misleading.
- Keep the title under 12 words and help text to one short sentence.
- Use plain language. Do not mention AI, schemas, tools, APIs, or internal reasoning.
- Never ask for a TIN or another sensitive identifier.
- Use distinct lowercase kebab-case question IDs so no topic repeats.
- Return ready as soon as the essentials are clear. Do not ask more than needed.
- When ready, summarize only facts supported by the description and answers. Use a plain descriptive businessLabel if no name was given.
- Always return status, question, and plan. For a question, set plan to null. When ready, set question to null.

The citizen profile city is ${body.city ?? "not confirmed"}.`,
      prompt: `Business description: ${prompt}\nLikely activity category from the service catalog: ${inferred.category}\nRelevant catalog flags already detected: ${inferred.flags.join(", ") || "none"}\n\nQuestions already answered:\n${answers.length ? JSON.stringify(answers, null, 2) : "None yet"}`,
    });

    if (result.object.status === "question" && result.object.question) {
      const asksForObviousStructure = /structure|sole proprietor|self-employed|freelance or business|type of registration|owned by one person|one person or multiple|how many owners|who will own|alone or with partners|operating.*partners/i.test(result.object.question.title);
      const partnerIsUnclear = /partner|co-owner|corporation|company with/i.test(prompt);
      if (asksForObviousStructure && !partnerIsUnclear && inferred.category !== "general-services") {
        return Response.json({ status: "question", question: fallbackQuestionFor(prompt, answers.length), source: "catalog" });
      }
      return Response.json({ status: "question", question: result.object.question, source: "vercel-ai-gateway" });
    }
    if (result.object.status === "ready" && result.object.plan) {
      return Response.json({ status: "ready", plan: result.object.plan, source: "vercel-ai-gateway" });
    }
    throw new Error("Gateway returned an incomplete decision");
  } catch (error) {
    console.error("AI Gateway question generation failed", error);
    return Response.json(fallbackDecision(prompt, body.city ?? "Philippines", answers));
  }
}
