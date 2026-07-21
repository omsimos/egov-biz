import type { IngestVideoCandidate } from "@/lib/types";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/time";

const INITIAL_DATA_MARKERS = ["var ytInitialData = ", 'window["ytInitialData"] = ', "ytInitialData = "];

function extractAssignedJson(html: string, markers: string[]): unknown {
  const marker = markers.find((candidate) => html.includes(candidate));
  if (!marker) throw new Error("YouTube channel data was not found");
  const start = html.indexOf("{", html.indexOf(marker) + marker.length);
  if (start < 0) throw new Error("YouTube channel data is malformed");

  let depth = 0;
  let escaped = false;
  let inString = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return JSON.parse(html.slice(start, index + 1));
  }
  throw new Error("YouTube channel data is incomplete");
}

function walk(value: unknown, output: Record<string, unknown>[]) {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && "videoId" in value) output.push(value as Record<string, unknown>);
  for (const child of Array.isArray(value) ? value : Object.values(value)) walk(child, output);
}

function textFrom(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) => (run && typeof run === "object" && typeof (run as { text?: unknown }).text === "string" ? (run as { text: string }).text : ""))
      .join("");
  }
  return "";
}

export async function fetchChannelVideos(channelUrl: string): Promise<IngestVideoCandidate[]> {
  const response = await fetch(channelUrl, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`YouTube channel returned ${response.status}`);

  const data = extractAssignedJson(await response.text(), INITIAL_DATA_MARKERS);
  const renderers: Record<string, unknown>[] = [];
  walk(data, renderers);
  const byVideoId = new Map<string, IngestVideoCandidate>();

  for (const renderer of renderers) {
    const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
    const title = textFrom(renderer.title);
    if (!videoId || !title || byVideoId.has(videoId)) continue;
    byVideoId.set(videoId, {
      videoId,
      title,
      watchUrl: youtubeWatchUrl(videoId),
      thumbnailUrl: youtubeThumbnailUrl(videoId),
      publishedText: textFrom(renderer.publishedTimeText),
      durationText: textFrom(renderer.lengthText),
      description: textFrom(renderer.descriptionSnippet),
    });
  }

  return [...byVideoId.values()];
}

const HEARING_TERMS = /committee|hearing|briefing|congress|session|consultative meeting|twg/i;

export function selectHearingCandidates(candidates: IngestVideoCandidate[], limit: number) {
  return candidates.filter((candidate) => HEARING_TERMS.test(candidate.title)).slice(0, limit);
}
