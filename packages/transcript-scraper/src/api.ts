import type { ExtractTranscriptOptions, TranscriptResult, TranscriptSegment } from "./types.js";

const YOUTUBE_WEB_ORIGIN = "https://www.youtube.com";
const WATCH_PAGE_MARKERS = {
  initialData: ["var ytInitialData = ", 'window["ytInitialData"] = ', "ytInitialData = "],
  playerResponse: [
    "var ytInitialPlayerResponse = ",
    'window["ytInitialPlayerResponse"] = ',
    "ytInitialPlayerResponse = ",
  ],
} as const;

/** Every value `JSON.parse` can produce; the watch page ships no narrower contract. */
type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

function isRecord(value: JsonValue | undefined): value is JsonObject {
  return value instanceof Object && !Array.isArray(value);
}

function getRecord(value: JsonValue | undefined): JsonObject | undefined {
  return isRecord(value) ? value : undefined;
}

function getArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function getPath(value: JsonValue | undefined, path: readonly string[]): JsonValue | undefined {
  let current = value;

  for (const key of path) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[key];
  }

  return current;
}

function getString(value: JsonValue | undefined): string | undefined {
  // YouTube publishes no schema for ytInitialData, so there is nothing to parse
  // this blob against; this is the leaf that turns a JSON scalar into a string.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  return typeof value === "string" ? value : undefined;
}

function extractAssignedJson(html: string, markers: readonly string[]): JsonValue {
  const marker = markers.find((candidate) => html.includes(candidate));
  if (!marker) throw new Error("YouTube page data was not found");

  const markerIndex = html.indexOf(marker);
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) throw new Error("YouTube page data is malformed");

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
    else if (character === "}" && --depth === 0) {
      return JSON.parse(html.slice(start, index + 1));
    }
  }

  throw new Error("YouTube page data is incomplete");
}

function findFirst(
  value: JsonValue | undefined,
  predicate: (candidate: JsonObject) => boolean,
): JsonObject | undefined {
  const record = getRecord(value);
  if (record && predicate(record)) return record;

  const children = record ? Object.values(record) : getArray(value);
  for (const child of children) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }

  return undefined;
}

function timestampToSeconds(timestamp: string): number {
  return timestamp.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function secondsToSrtTimestamp(seconds: number): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;

  return `${[hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":")},${String(millis).padStart(3, "0")}`;
}

function getStringMatch(html: string, pattern: RegExp, description: string): string {
  const value = html.match(pattern)?.[1];
  if (!value) throw new Error(`YouTube ${description} was not found`);
  return value;
}

function isYoutubeHostname(hostname: string): boolean {
  return (
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com")
  );
}

function getTrackName(track: JsonObject | undefined): string {
  const simpleText = getString(getPath(track, ["name", "simpleText"]));
  if (simpleText) return simpleText;

  const runs = getArray(getPath(track, ["name", "runs"]));
  const runText = runs
    .map((run) => getString(getRecord(run)?.text))
    .filter((text): text is string => text !== undefined)
    .join("");

  return runText || "Transcript";
}

function readTranscriptSegments(panelData: JsonValue): TranscriptSegment[] {
  const sectionContents = getArray(
    getPath(panelData, [
      "content",
      "engagementPanelSectionListRenderer",
      "content",
      "sectionListRenderer",
      "contents",
    ]),
  );

  return sectionContents
    .flatMap((section) => getArray(getPath(section, ["itemSectionRenderer", "contents"])))
    .flatMap((entry): TranscriptSegment[] => {
      const item = getPath(entry, [
        "macroMarkersPanelItemViewModel",
        "item",
        "timelineItemViewModel",
      ]);
      const segment = getArray(getPath(item, ["contentItems"]))
        .map((content) => getRecord(getPath(content, ["transcriptSegmentViewModel"])))
        .find((candidate) => candidate !== undefined);
      const timestamp = getString(segment?.timestamp) ?? getString(getRecord(item)?.timestamp);
      const text = getString(segment?.simpleText);

      return text && timestamp ? [{ start: timestampToSeconds(timestamp), text, timestamp }] : [];
    })
    .sort((left, right) => left.start - right.start);
}

export function parseYouTubeVideoId(input: string): string {
  const value = String(input ?? "").trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid YouTube URL");
  }

  let candidate: string | null | undefined;
  if (url.hostname === "youtu.be" || url.hostname.endsWith(".youtu.be")) {
    candidate = url.pathname.split("/").filter(Boolean)[0];
  } else if (isYoutubeHostname(url.hostname)) {
    candidate = url.searchParams.get("v");

    if (!candidate) {
      const [route, id] = url.pathname.split("/").filter(Boolean);
      if (route && ["embed", "live", "shorts"].includes(route)) candidate = id;
    }
  }

  if (!candidate || !/^[A-Za-z0-9_-]{11}$/.test(candidate)) {
    throw new Error("The URL does not contain a valid YouTube video ID");
  }

  return candidate;
}

export function segmentsToSrt(segments: readonly TranscriptSegment[], videoDuration = 0): string {
  return `${segments
    .map((segment, index) => {
      const nextStart = segments[index + 1]?.start;
      const fallbackEnd = videoDuration > segment.start ? videoDuration : segment.start + 10;
      const boundary = nextStart ?? fallbackEnd;
      const end = Math.max(segment.start + 0.25, Math.min(boundary - 0.001, segment.start + 10));

      return [
        index + 1,
        `${secondsToSrtTimestamp(segment.start)} --> ${secondsToSrtTimestamp(end)}`,
        segment.text,
      ].join("\n");
    })
    .join("\n\n")}\n`;
}

export async function getYouTubeTranscript(
  input: string,
  options: ExtractTranscriptOptions = {},
): Promise<TranscriptResult> {
  const videoId = parseYouTubeVideoId(input);
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const watchUrl = `${YOUTUBE_WEB_ORIGIN}/watch?v=${videoId}`;

  const watchResponse = await fetchImplementation(watchUrl, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (compatible; TranscriptClient/1.0)",
    },
    signal,
  });

  if (!watchResponse.ok) {
    throw new Error(`YouTube returned ${watchResponse.status}`);
  }

  const html = await watchResponse.text();
  const initialData = extractAssignedJson(html, WATCH_PAGE_MARKERS.initialData);
  const playerResponse = extractAssignedJson(html, WATCH_PAGE_MARKERS.playerResponse);
  const playabilityStatus = getString(getPath(playerResponse, ["playabilityStatus", "status"]));

  if (playabilityStatus !== "OK") {
    throw new Error(
      getString(getPath(playerResponse, ["playabilityStatus", "reason"])) ??
        "This video is unavailable",
    );
  }

  const transcriptWrapper = findFirst(initialData, (node) =>
    isRecord(node.videoDescriptionTranscriptSectionRenderer),
  );
  const transcriptSection = getRecord(transcriptWrapper?.videoDescriptionTranscriptSectionRenderer);
  const commands = getArray(
    getPath(transcriptSection, [
      "primaryButton",
      "buttonRenderer",
      "command",
      "commandExecutorCommand",
      "commands",
    ]),
  );
  const showPanel = commands
    .map((command) => getRecord(getPath(command, ["showEngagementPanelEndpoint"])))
    .find((candidate) => candidate !== undefined);

  if (!showPanel) {
    throw new Error("This video does not expose a transcript");
  }

  const apiKey = getStringMatch(html, /"INNERTUBE_API_KEY":"([^"]+)"/, "web client key");
  const clientVersion = getStringMatch(
    html,
    /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/,
    "web client version",
  );

  const panelResponse = await fetchImplementation(
    `${YOUTUBE_WEB_ORIGIN}/youtubei/v1/get_panel?prettyPrint=false&key=${encodeURIComponent(apiKey)}`,
    {
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion,
            gl: "US",
            hl: "en",
          },
        },
        panelId: getPath(showPanel, ["identifier", "tag"]),
        params: getPath(showPanel, ["globalConfiguration", "params"]),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    },
  );

  if (!panelResponse.ok) {
    throw new Error(`YouTube transcript request returned ${panelResponse.status}`);
  }

  const segments = readTranscriptSegments(await panelResponse.json());
  if (segments.length === 0) {
    throw new Error("YouTube returned an empty transcript");
  }

  const tracks = getArray(
    getPath(playerResponse, ["captions", "playerCaptionsTracklistRenderer", "captionTracks"]),
  ).map(getRecord);
  const selectedTrack = tracks.find((track) => getString(track?.kind) === "asr") ?? tracks[0];
  const durationSeconds = Number(getPath(playerResponse, ["videoDetails", "lengthSeconds"]) ?? 0);

  return {
    autogenerated: getString(selectedTrack?.kind) === "asr",
    durationSeconds,
    languageCode: getString(selectedTrack?.languageCode) ?? "unknown",
    segments,
    srt: segmentsToSrt(segments, durationSeconds),
    title: getString(getPath(playerResponse, ["videoDetails", "title"])) ?? videoId,
    trackName: getTrackName(selectedTrack),
    videoId,
    watchUrl,
  };
}

export const extractTranscript = getYouTubeTranscript;
