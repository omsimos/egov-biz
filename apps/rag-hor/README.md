# RAG-HOR

A timestamp-grounded research agent for Philippine House of Representatives video hearings.

See the [eGov process-efficiency integration backlog](docs/egov-integrations/README.md) for
workflow accelerators that can be prototyped with the hackathon eGov APIs.

The POC has two surfaces:

1. An indexed hearing catalog sourced from the official [House of Representatives PH YouTube channel](https://www.youtube.com/@HouseofRepresentativesPH).
2. A synchronized workspace with YouTube on the left, a clickable live transcript in the middle, and a persistent RAG agent on the right.

## Stack

- Next.js 16, React 19, Tailwind CSS 4
- Bun for package management and project scripts
- SQLite (`better-sqlite3`) for hearing metadata, transcript segments, conversations, and AI SDK UI messages
- Qdrant for timestamp-aware transcript vectors
- Redis + `resumable-stream` for reconnectable AI SDK SSE responses
- Vercel AI Gateway through AI SDK 7, with one `AI_GATEWAY_API_KEY` for chat and embeddings
- AI SDK 7 `ToolLoopAgent` with explicit `searchHearing`, `webSearch`, and `fetchWebPage` tools
- A vendored Bun workspace package at `packages/transcript-scraper`, sourced from the team's eGov scripts reference
- Portless at `https://rag-hor.localhost`

## Quick start

Prerequisites: Bun 1.3+, Docker, and a Vercel AI Gateway API key.

```bash
cd rag-hor
bun install
cp .env.example .env.local
# Add AI_GATEWAY_API_KEY
bun run infra:up
bun run ingest:sample
bun run dev
```

Portless serves the app at `https://rag-hor.localhost`. To bypass Portless, run `bun run dev:direct` and open `http://localhost:3000`.

## Preprocessing / ingestion

The CLI prints each stage so indexing progress and failures are visible:

```text
FETCH       fetching YouTube transcript
CHUNK       355 timed segments
EMBED       40 citation-aware chunks
STORE       saved SQLite metadata + transcript
READY       hearing is available in the catalog
```

### Ingest the verified five-video POC set

```bash
bun run ingest:sample
```

These five public records were checked for transcript availability:

- Committee on Transportation (Part 2)
- Committee on Appropriations — FY 2025 DOLE budget hearing
- Committee on Transportation — March 7, 2024 (Part 2)
- DCC TWG on Peace and Order
- 3rd Consultative Meeting of the Young Parliamentarians of AIPA

### Ingest one video

```bash
bun run ingest -- --video 'https://www.youtube.com/watch?v=VIDEO_ID'
```

### Scrape the current channel catalog

```bash
bun run ingest -- --channel --limit 5
```

Channel mode parses YouTube's public page data, filters for hearing-like titles, and attempts the first `--limit` records. YouTube does not expose transcripts for every upload; one failed video is logged and does not abort the remaining queue.

### Citation-aware chunk shape

Every Qdrant point includes:

```ts
{
  hearingId,
  videoId,
  title,
  text,
  startSeconds,
  endSeconds,
  startSegment,
  endSegment,
  segmentIds
}
```

Chunks are bounded by text size and time range, with a two-segment overlap. This keeps semantic context while retaining an exact seek range. The agent returns citations as `[6:46](#t=406)`, and the UI routes those links through the same player seek function used by transcript rows and tool-result cards.

Re-ingesting a video replaces its Qdrant points and transcript segments instead of duplicating them.

## Agent and chat lifecycle

- `searchHearing` embeds a query and applies a mandatory Qdrant `hearingId` filter.
- `webSearch` uses Exa when `EXA_API_KEY` is set. It returns a configuration message when disabled.
- `fetchWebPage` reads one public HTTP(S) result, strips page chrome, caps content size, and blocks localhost/private hosts.
- The system prompt requires transcript search before hearing claims and inline timestamp citations for material claims.
- Completed AI SDK UI messages—including tool calls and outputs—are persisted to SQLite.
- A conversation's `active_stream_id` points to its Redis-backed SSE stream while generation is active.
- `useChat({ resume: true })` reconnects through `GET /api/chat/:conversationId/stream` after navigation or refresh.
- New research threads can be created and reopened from the agent-panel header.

## Data ownership

```text
SQLite
├── hearings
├── transcript_segments
├── conversations
└── messages (AI SDK UIMessage parts JSON)

Qdrant
└── hearing-transcripts (semantic chunks + exact timeline payload)

Redis
└── transient resumable SSE buffers (24-hour expiry from resumable-stream)
```

Local SQLite data is stored under `data/` and Docker data is stored in named volumes. Both survive app restarts. To clear the local app database:

```bash
bun run db:reset
```

To stop infrastructure without deleting volumes:

```bash
bun run infra:down
```

## Models, cost, and eGov AI

The app uses Vercel AI Gateway for both generation and embeddings. The defaults are deliberately inexpensive:

- Chat/agent: `google/gemini-2.5-flash-lite` — tool calling with a large context window at $0.10/M input and $0.40/M output at the time of implementation.
- Embeddings: `openai/text-embedding-3-small` — low-cost 1,536-dimensional vectors that match the default Qdrant schema.

Both use the same `AI_GATEWAY_API_KEY`. Override `CHAT_MODEL`, `EMBEDDING_MODEL`, and `EMBEDDING_DIMENSIONS` in `.env.local` if needed. Changing embedding dimensions requires recreating the Qdrant collection/volume before re-ingesting.

The team's `@repo/egov` reference also exposes the hackathon eGov AI assistant API. That endpoint is useful as an additional tool or non-streaming generation adapter, but its catalog contract does not expose embeddings or AI SDK-compatible streamed tool calls. Keep Qdrant embeddings on Gateway; add eGov AI behind a dedicated tool if hackathon judging requires that API to be demonstrated.

## Validation

```bash
bun run typecheck
bun run lint
bun run build
```

The implemented flow was smoke-tested with a live YouTube transcript, 355 timed SQLite segments, 40 Qdrant points, browser transcript seeking, and persistent thread creation. Real agent generation requires your configured model key.
