import { createHash } from "node:crypto";
import type { HearingChunk, TranscriptSegment } from "@/lib/types";

const DEFAULT_MAX_CHARACTERS = 1_600;
const DEFAULT_MAX_DURATION_SECONDS = 95;
const DEFAULT_OVERLAP_SEGMENTS = 2;

function qdrantPointId(input: string) {
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`;
}

export function chunkTranscript(
  hearing: { id: string; videoId: string; title: string },
  segments: TranscriptSegment[],
): HearingChunk[] {
  const chunks: HearingChunk[] = [];
  let cursor = 0;

  while (cursor < segments.length) {
    const startIndex = cursor;
    let endIndex = cursor;
    let characterCount = 0;

    while (endIndex < segments.length) {
      const segment = segments[endIndex];
      const first = segments[startIndex];
      if (!segment || !first) break;
      const nextCount = characterCount + segment.text.length + 1;
      const nextDuration = segment.endSeconds - first.startSeconds;

      if (
        endIndex > startIndex &&
        (nextCount > DEFAULT_MAX_CHARACTERS || nextDuration > DEFAULT_MAX_DURATION_SECONDS)
      ) {
        break;
      }

      characterCount = nextCount;
      endIndex += 1;
    }

    const slice = segments.slice(startIndex, Math.max(startIndex + 1, endIndex));
    const first = slice[0];
    const last = slice.at(-1);
    if (!first || !last) break;

    chunks.push({
      id: qdrantPointId(`${hearing.videoId}:${first.position}-${last.position}`),
      hearingId: hearing.id,
      videoId: hearing.videoId,
      title: hearing.title,
      text: slice.map((segment) => segment.text).join(" "),
      startSeconds: first.startSeconds,
      endSeconds: last.endSeconds,
      startSegment: first.position,
      endSegment: last.position,
      segmentIds: slice.map((segment) => segment.id),
    });

    if (endIndex >= segments.length) break;
    cursor = Math.max(startIndex + 1, endIndex - DEFAULT_OVERLAP_SEGMENTS);
  }

  return chunks;
}
