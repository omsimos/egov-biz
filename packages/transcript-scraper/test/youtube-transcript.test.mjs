import assert from "node:assert/strict";
import test from "node:test";
import { parseYouTubeVideoId, segmentsToSrt } from "../lib/youtube-transcript.mjs";

test("parses common YouTube URL formats", () => {
  const id = "AMeSZvb_4FA";

  assert.equal(parseYouTubeVideoId(id), id);
  assert.equal(parseYouTubeVideoId(`https://youtu.be/${id}`), id);
  assert.equal(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${id}&t=4s`), id);
  assert.equal(parseYouTubeVideoId(`https://youtube.com/shorts/${id}`), id);
  assert.equal(parseYouTubeVideoId(`https://youtube.com/embed/${id}`), id);
});

test("rejects non-YouTube and malformed URLs", () => {
  assert.throws(() => parseYouTubeVideoId("https://example.com/watch?v=AMeSZvb_4FA"));
  assert.throws(() => parseYouTubeVideoId("not a URL"));
  assert.throws(() => parseYouTubeVideoId("https://youtube.com/watch?v=short"));
});

test("formats timestamped segments as SRT", () => {
  const srt = segmentsToSrt(
    [
      { start: 4, text: "Hello", timestamp: "0:04" },
      { start: 9.5, text: "World", timestamp: "0:09" },
    ],
    12,
  );

  assert.match(srt, /00:00:04,000 --> 00:00:09,499/);
  assert.match(srt, /00:00:09,500 --> 00:00:11,999/);
  assert.match(srt, /Hello/);
  assert.match(srt, /World/);
});
