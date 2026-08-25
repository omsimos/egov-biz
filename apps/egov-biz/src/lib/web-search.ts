import { createGateway, stepCountIs, streamText } from "ai";
import { payloadRecord, payloadText, type PayloadValue } from "@/lib/payload";

/**
 * Exa runs on the AI Gateway, so the gateway key authenticates the search and
 * there is no separate Exa credential. The tool is provider-executed: the
 * gateway performs the search while answering a model request, which is why
 * every search here goes through a model call instead of being invoked directly.
 */
type Gateway = ReturnType<typeof createGateway>;

export type OfficialSource = { title: string; url: string };

type ExaResult = { title?: PayloadValue; url?: PayloadValue };

/**
 * Only .gov.ph hosts count. Matching the hostname rather than the whole URL
 * keeps a path like /redirect?to=x.gov.ph from passing as official.
 */
export function isOfficialSource(url: string) {
  try {
    return /(^|\.)gov\.ph$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * A provider-executed tool reports a failed search as an output object with an
 * `error` field rather than by throwing, so both shapes have to be checked.
 */
function resultsFrom(outputs: readonly unknown[]) {
  const results: ExaResult[] = [];
  let failed = false;
  for (const output of outputs) {
    const record = payloadRecord(output);
    if ("error" in record) {
      failed = true;
      continue;
    }
    const list = record.results;
    if (Array.isArray(list)) {
      // SAFETY: ExaResult leaves both of its fields unparsed, so any decoded
      // array element already satisfies it; officialSourcesFrom below re-reads
      // each field through the payload parsers before using it.
      results.push(...(list as ExaResult[]));
    }
  }
  return { results, failed };
}

export function officialSourcesFrom(results: readonly ExaResult[], limit = 5) {
  const sources: OfficialSource[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const url = payloadText(result.url);
    const title = payloadText(result.title).trim();
    if (!url || !title || seen.has(url) || !isOfficialSource(url)) continue;
    seen.add(url);
    sources.push({ title, url });
    if (sources.length === limit) break;
  }
  return sources;
}

export type ExaSearchRun = {
  /** The query the model actually sent, empty when it never reached the tool. */
  query: string;
  results: ExaResult[];
  failed: boolean;
};

export async function runExaSearch({
  gateway,
  model,
  system,
  prompt,
  numResults = 5,
  abortSignal,
  onQuery,
}: {
  gateway: Gateway;
  model: Parameters<typeof streamText>[0]["model"];
  system: string;
  prompt: string;
  numResults?: number;
  abortSignal?: AbortSignal;
  onQuery?: (query: string) => void;
}): Promise<ExaSearchRun> {
  let query = "";
  const outputs: unknown[] = [];
  let errored = false;
  try {
    // Streaming rather than generateText so the query is known as soon as the
    // model emits the call. gatewayTools.exaSearch takes search options only,
    // with no input callbacks, so the stream is the earliest hook available.
    const generated = streamText({
      model,
      system,
      prompt,
      tools: {
        exa_search: gateway.tools.exaSearch({
          numResults,
          contents: { highlights: true },
        }),
      },
      toolChoice: { type: "tool", toolName: "exa_search" },
      stopWhen: stepCountIs(1),
      timeout: { totalMs: 12_000, toolMs: 8_000 },
      abortSignal,
    });
    for await (const part of generated.fullStream) {
      if (part.type === "tool-call") {
        const asked = payloadRecord(part.input).query;
        query = payloadText(asked).trim().slice(0, 180);
        if (query) onQuery?.(query);
      } else if (part.type === "tool-result") outputs.push(part.output);
      else if (part.type === "tool-error") errored = true;
    }
  } catch {
    return { query, results: [], failed: true };
  }
  const { results, failed } = resultsFrom(outputs);
  return { query, results, failed: (failed || errored) && results.length === 0 };
}
