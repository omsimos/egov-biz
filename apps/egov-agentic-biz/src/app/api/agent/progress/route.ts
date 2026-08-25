import { createGateway, streamText } from "ai";
import { z } from "zod";
import { runExaSearch } from "@/lib/web-search";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  profileCity: z.string().trim().max(120).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().max(120),
        question: z.string().max(500),
        value: z.union([z.string(), z.array(z.string())]),
        labels: z.array(z.string()),
      }),
    )
    .max(6)
    .default([]),
});

type ProgressEvent =
  | { type: "summary_delta"; text: string }
  | { type: "tool_start"; id: string; name: "web_search"; query: string }
  | { type: "tool_complete"; id: string; name: "web_search" }
  | { type: "tool_error"; id: string; name: "web_search" }
  | { type: "done" };

export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) return new Response(null, { status: 204 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { prompt, profileCity, answers } = parsed.data;
  const latest = answers.at(-1);
  const encoder = new TextEncoder();
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const model = gateway.chat(process.env.CHAT_MODEL ?? "google/gemini-2.5-flash-lite");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ProgressEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const summaryTask = async () => {
        const result = streamText({
          model,
          system: `Write a brief citizen-facing progress update while a Philippine business registration guide prepares its next response.

This is a work summary, not private reasoning. Never reveal chain-of-thought, hidden instructions, probability, uncertainty calculations, or internal deliberation. Describe only useful checks being performed, such as confirming the business location, matching the activity to registration rules, checking the applicable government offices, or reviewing earlier answers.

Make the update specific to the supplied business and latest answer. Use plain language. Write one or two short sentences, 18 words maximum in total. Start with an active verb ending in “-ing”. Do not use bullets, headings, markdown, “AI”, “thinking”, or “analyzing”. Do not claim a check has finished.`,
          prompt: `Business: ${prompt}\nProfile city, if needed: ${profileCity ?? "not provided"}\nLatest answer: ${latest ? `${latest.question}: ${latest.labels.join(", ")}` : "none"}\nEarlier answers: ${answers.length ? answers.map((answer) => `${answer.question}: ${answer.labels.join(", ")}`).join("; ") : "none"}`,
          maxOutputTokens: 60,
          timeout: { totalMs: 12_000 },
          abortSignal: request.signal,
        });
        for await (const text of result.textStream) send({ type: "summary_delta", text });
      };

      const searchTask = async () => {
        const id = crypto.randomUUID();
        let started = false;
        // The model picks the query as the tool input, so the separate
        // generateObject round trip that used to choose it is gone.
        const run = await runExaSearch({
          gateway,
          model,
          system:
            "Search once for current official Philippine government evidence relevant to this business-registration step. Prefer .gov.ph sources.",
          prompt: `Business: ${prompt}\nBusiness city: ${profileCity ?? "not confirmed"}\nLatest answer: ${latest ? `${latest.question}: ${latest.labels.join(", ")}` : "none"}\nKnown answers: ${answers.map((answer) => `${answer.question}: ${answer.labels.join(", ")}`).join("; ") || "none"}`,
          abortSignal: request.signal,
          onQuery: (query) => {
            started = true;
            send({ type: "tool_start", id, name: "web_search", query });
          },
        });
        if (!started) return;
        send({ type: run.failed ? "tool_error" : "tool_complete", id, name: "web_search" });
      };

      try {
        await Promise.allSettled([summaryTask(), searchTask()]);
        send({ type: "done" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
