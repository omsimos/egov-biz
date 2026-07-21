# Transcript Scraper

A dependency-free TypeScript package for extracting the transcript exposed by a
public YouTube video.

## Usage

```ts
import { extractTranscript } from "@repo/transcript-scraper";

const transcript = await extractTranscript("https://www.youtube.com/watch?v=VIDEO_ID");

console.log(transcript.segments);
console.log(transcript.srt);
```

The result includes the video metadata, timestamped segments, and an SRT string.
Pass an `AbortSignal`, timeout, or custom `fetch` implementation through the
optional second argument.

## Test

```sh
bun test
```

The extractor reads YouTube's public watch-page data and calls the same internal
transcript-panel endpoint used by the website. That endpoint is undocumented and
may change without notice. Private, restricted, unavailable, or transcript-free
videos are rejected.
