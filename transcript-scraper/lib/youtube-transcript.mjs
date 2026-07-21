const YOUTUBE_WEB_ORIGIN = "https://www.youtube.com";
const WATCH_PAGE_MARKERS = {
  initialData: [
    "var ytInitialData = ",
    'window["ytInitialData"] = ',
    "ytInitialData = ",
  ],
  playerResponse: [
    "var ytInitialPlayerResponse = ",
    'window["ytInitialPlayerResponse"] = ',
    "ytInitialPlayerResponse = ",
  ],
};

function extractAssignedJson(html, markers) {
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

function findFirst(value, predicate) {
  if (!value || typeof value !== "object") return undefined;
  if (predicate(value)) return value;

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }

  return undefined;
}

function timestampToSeconds(timestamp) {
  return timestamp
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0);
}

function secondsToSrtTimestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;

  return `${[hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":")},${String(millis).padStart(3, "0")}`;
}

function getStringMatch(html, pattern, description) {
  const value = html.match(pattern)?.[1];
  if (!value) throw new Error(`YouTube ${description} was not found`);
  return value;
}

function youtubeHostname(hostname) {
  return (
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com")
  );
}

export function parseYouTubeVideoId(input) {
  const value = String(input ?? "").trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid YouTube URL");
  }

  let candidate;
  if (url.hostname === "youtu.be" || url.hostname.endsWith(".youtu.be")) {
    candidate = url.pathname.split("/").filter(Boolean)[0];
  } else if (youtubeHostname(url.hostname)) {
    candidate = url.searchParams.get("v");

    if (!candidate) {
      const [route, id] = url.pathname.split("/").filter(Boolean);
      if (["embed", "live", "shorts"].includes(route)) candidate = id;
    }
  }

  if (!candidate || !/^[A-Za-z0-9_-]{11}$/.test(candidate)) {
    throw new Error("The URL does not contain a valid YouTube video ID");
  }

  return candidate;
}

export function segmentsToSrt(segments, videoDuration = 0) {
  return `${segments
    .map((segment, index) => {
      const nextStart = segments[index + 1]?.start;
      const fallbackEnd = videoDuration > segment.start
        ? videoDuration
        : segment.start + 10;
      const boundary = nextStart ?? fallbackEnd;
      const end = Math.max(
        segment.start + 0.25,
        Math.min(boundary - 0.001, segment.start + 10),
      );

      return [
        index + 1,
        `${secondsToSrtTimestamp(segment.start)} --> ${secondsToSrtTimestamp(end)}`,
        segment.text,
      ].join("\n");
    })
    .join("\n\n")}\n`;
}

export async function getYouTubeTranscript(input, options = {}) {
  const videoId = parseYouTubeVideoId(input);
  const signal = options.signal ?? AbortSignal.timeout(20_000);
  const watchUrl = `${YOUTUBE_WEB_ORIGIN}/watch?v=${videoId}`;

  const watchResponse = await fetch(watchUrl, {
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
  const initialData = extractAssignedJson(
    html,
    WATCH_PAGE_MARKERS.initialData,
  );
  const playerResponse = extractAssignedJson(
    html,
    WATCH_PAGE_MARKERS.playerResponse,
  );

  if (playerResponse.playabilityStatus?.status !== "OK") {
    throw new Error(
      playerResponse.playabilityStatus?.reason ?? "This video is unavailable",
    );
  }

  const transcriptWrapper = findFirst(
    initialData,
    (node) => Boolean(node.videoDescriptionTranscriptSectionRenderer),
  );
  const transcriptSection =
    transcriptWrapper?.videoDescriptionTranscriptSectionRenderer;
  const commands =
    transcriptSection?.primaryButton?.buttonRenderer?.command
      ?.commandExecutorCommand?.commands ?? [];
  const showPanel = commands.find(
    (command) => command.showEngagementPanelEndpoint,
  )?.showEngagementPanelEndpoint;

  if (!showPanel) {
    throw new Error("This video does not expose a transcript");
  }

  const apiKey = getStringMatch(
    html,
    /"INNERTUBE_API_KEY":"([^"]+)"/,
    "web client key",
  );
  const clientVersion = getStringMatch(
    html,
    /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/,
    "web client version",
  );

  const panelResponse = await fetch(
    `${YOUTUBE_WEB_ORIGIN}/youtubei/v1/get_panel?prettyPrint=false&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion,
            gl: "US",
            hl: "en",
          },
        },
        panelId: showPanel.identifier?.tag,
        params: showPanel.globalConfiguration?.params,
      }),
      signal,
    },
  );

  if (!panelResponse.ok) {
    throw new Error(`YouTube transcript request returned ${panelResponse.status}`);
  }

  const panelData = await panelResponse.json();
  const sectionContents =
    panelData.content?.engagementPanelSectionListRenderer?.content
      ?.sectionListRenderer?.contents ?? [];

  const segments = sectionContents
    .flatMap((section) => section.itemSectionRenderer?.contents ?? [])
    .flatMap((entry) => {
      const item =
        entry.macroMarkersPanelItemViewModel?.item?.timelineItemViewModel;
      const segment = item?.contentItems
        ?.map((content) => content.transcriptSegmentViewModel)
        .find(Boolean);
      const timestamp = segment?.timestamp ?? item?.timestamp;

      return segment?.simpleText && timestamp
        ? [{
            start: timestampToSeconds(timestamp),
            text: segment.simpleText,
            timestamp,
          }]
        : [];
    })
    .sort((left, right) => left.start - right.start);

  if (segments.length === 0) {
    throw new Error("YouTube returned an empty transcript");
  }

  const tracks =
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const selectedTrack =
    tracks.find((track) => track.kind === "asr") ?? tracks[0];
  const trackName =
    selectedTrack?.name?.simpleText ??
    selectedTrack?.name?.runs?.map((run) => run.text).join("") ??
    "Transcript";
  const durationSeconds = Number(
    playerResponse.videoDetails?.lengthSeconds ?? 0,
  );

  return {
    autogenerated: selectedTrack?.kind === "asr",
    durationSeconds,
    languageCode: selectedTrack?.languageCode ?? "unknown",
    segments,
    srt: segmentsToSrt(segments, durationSeconds),
    title: playerResponse.videoDetails?.title ?? videoId,
    trackName,
    videoId,
    watchUrl,
  };
}
