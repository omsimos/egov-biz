import * as cheerio from "cheerio";
import { env } from "@/lib/env";

const MAX_PAGE_CHARACTERS = 12_000;

function isPublicHttpUrl(input: string) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return false;
  }
  return true;
}

export async function webSearch(query: string, resultCount = 5) {
  if (!env.exaApiKey) {
    return {
      configured: false,
      message: "Web search is not configured. Set EXA_API_KEY to enable current-source research.",
      results: [],
    };
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.exaApiKey },
    body: JSON.stringify({ query, numResults: Math.min(resultCount, 8), type: "auto", contents: { text: true } }),
  });
  if (!response.ok) throw new Error(`Web search failed with ${response.status}`);
  const data = (await response.json()) as {
    results?: { title?: string; url?: string; publishedDate?: string; text?: string }[];
  };
  return {
    configured: true,
    results: (data.results ?? []).map((result) => ({
      title: result.title ?? result.url ?? "Untitled source",
      url: result.url ?? "",
      publishedDate: result.publishedDate ?? null,
      excerpt: result.text?.slice(0, 1_800) ?? "",
    })),
  };
}

export async function fetchWebPage(urlInput: string) {
  if (!isPublicHttpUrl(urlInput)) throw new Error("Only public HTTP(S) pages can be fetched.");
  const response = await fetch(urlInput, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "RAG-HOR civic research agent/0.1" },
  });
  if (!response.ok) throw new Error(`Page fetch failed with ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error(`Unsupported page type: ${contentType || "unknown"}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer").remove();
  const title = $("title").text().trim() || $("h1").first().text().trim() || response.url;
  const text = $("main, article, body").first().text().replace(/\s+/g, " ").trim();
  return { title, url: response.url, text: text.slice(0, MAX_PAGE_CHARACTERS), truncated: text.length > MAX_PAGE_CHARACTERS };
}
