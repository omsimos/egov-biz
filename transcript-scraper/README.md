# YouTube Transcript Client

A minimal dependency-free web client for extracting the transcript exposed by a
public YouTube video. It previews timestamped segments and downloads SRT or JSON.

## Run

Requires Node.js 20 or newer.

```sh
npm start
```

Open <http://127.0.0.1:4173>, paste a YouTube URL, and select **Extract
transcript**.

## Test

```sh
npm test
```

The extractor reads YouTube's public watch-page data and calls the same internal
transcript-panel endpoint used by the website. That endpoint is undocumented and
may change without notice. Private, restricted, unavailable, or transcript-free
videos are rejected.
