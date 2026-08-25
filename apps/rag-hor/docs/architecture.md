# RAG-HOR — Product Architecture

_The hearing fact-checking product, built on the shared eGov foundation._

- **Concept, feasibility & impact:** [`research-paper.md`](./research-paper.md)
- **Shared eGov API/SDK reference:** [`../../../docs/architecture.md`](../../../docs/architecture.md)

RAG-HOR turns Philippine congressional hearing livestreams into an accessible,
fact-checked record: a hearing video is transcribed with timestamps, refined, and
handed to a multi-agent RAG pipeline that grounds every claim in credible government
data and returns each as `claim → verdict → cited source → backing excerpt`.

This document describes what is **built today** and, where they differ, the **target
architecture** the team is moving toward (migrating agent orchestration to **eve** on
Vercel, and adding the government-data grounding layer).

---

## 1. Composition pipeline (target)

The target composition is below; §3 records what is actually wired in `rag-hor` today (a subset).

```
                         ┌─────────────────────────────────────────┐
 YouTube hearing URL ──► │ transcript-scraper                        │
                         │  → segments[] (start,text,timestamp), srt │
                         └───────────────┬───────────────────────────┘
                                         ▼
                         ┌─────────────────────────────────────────┐
                         │ Refinement middleware  (Omsimos)          │
                         │  eGov AI: ai_assistant (repair/summarize) │
                         │           translator (FIL↔EN)             │
                         │  + confidence flagging (our logic)        │
                         └───────────────┬───────────────────────────┘
                                         ▼
                         ┌─────────────────────────────────────────┐
                         │ Orchestrator (eve)                        │
                         │  routes each claim to a specialized       │
                         │  subagent, then aggregates verdicts       │
                         │  ┌─────────────────────────────────────┐  │
                         │  │ eGov AI subagent (own endpoint)      │  │
                         │  │ BetterGov + Juris subagent (MCP)     │  │
                         │  │ Compass budget subagent (SDK)        │  │
                         │  │ Web-search subagent (trusted allow-  │  │
                         │  │   list, corroboration only)          │  │
                         │  └─────────────────────────────────────┘  │
                         └───────────────┬───────────────────────────┘
                                         ▼
                         ┌─────────────────────────────────────────┐
                         │ Fact-checker (aggregation)                │
                         │  claim → verdict → cited source → excerpt │
                         └───────────────┬───────────────────────────┘
                                         ▼
             ┌───────────────────────────────────────────────────────────┐
             │ Surfaces & side-effects                                     │
             │  • Views: agenda calendar, legislative-data explorer        │
             │  • eMessage: SMS alerts   • eGovChain: optional hash anchor │
             └───────────────────────────────────────────────────────────┘
```

Data-source ownership by claim type: **legislative status** → BetterGov Open Congress
API; **legal claim** → Juris.ph MCP; **budget figure** → **eGov Compass** (authenticated,
via the SDK). eGov AI is the text-processing layer, not a data source; trusted-source web
search corroborates but never grounds a verdict alone. For each service's capabilities and
auth, see the [eGov API reference](../../../docs/architecture.md) §3.

## 2. Agent orchestration — current and target

**Current (`rag-hor`):** a single **AI SDK 7 `ToolLoopAgent`** (chat model on Vercel AI
Gateway) with three explicit tools — `searchHearing` (Qdrant transcript search with a
mandatory `hearingId` filter), `webSearch` (Exa, when `EXA_API_KEY` is set), and
`fetchWebPage` (one public URL, chrome-stripped, private hosts blocked). The system prompt
requires transcript search before hearing claims and inline timestamp citations. This
grounds answers in the hearing's **own transcript** plus open web — it does not yet
cross-reference the government-data sources.

**Target:** migrate orchestration to **eve** (Vercel) and split the single agent into
**specialized subagents**, each owning one source and its access protocol:

- **eGov AI subagent** — eGov AI endpoint (`ai_assistant`/`translator`/`document_extractor`) for transcript repair, translation, summarization, OCR.
- **BetterGov + Juris subagent** — **direct MCP access** to Juris.ph (`search_jurisprudence`/`get_case`, `search_republic_acts`/`get_republic_act`) and BetterGov Open Congress for legislative records.
- **Compass budget subagent** — the typed Compass SDK (SARO/NCA/SAAODB/LGSF) for budget figures.
- **Web-search subagent** — restricted to the trusted-source allowlist; corroboration only.

The orchestrator classifies each extracted claim, dispatches it to the subagent that owns
the authoritative source, and aggregates the evidence into the
`claim → verdict → cited source → backing excerpt` result. Isolating each source in its own
subagent keeps tools/credentials scoped, encapsulates each access protocol (REST, MCP, SDK),
and makes sources cheap to add or swap. The current `ToolLoopAgent`/tool design is a clean
stepping stone: today's tools become tomorrow's subagents.

## 3. Current implementation — `apps/rag-hor`

The product app is built and runnable today:

- **Next.js 16 + React 19 + Tailwind 4**, Bun scripts, served via Portless at `https://rag-hor.localhost`.
- **AI SDK 7** through **Vercel AI Gateway** (one `AI_GATEWAY_API_KEY` for both chat and embeddings). Defaults are deliberately cheap: chat `google/gemini-2.5-flash-lite`, embeddings `openai/text-embedding-3-small` (1,536-dim). eGov AI is **not** the inference layer — its catalog exposes neither embeddings nor AI SDK-compatible streamed tool calls, so it is a candidate _additional tool_, not the model backend.
- **Qdrant** for timestamp-aware transcript vectors; **SQLite** (`better-sqlite3`) for hearing metadata, transcript segments, conversations, and AI SDK UI messages; **Redis** + `resumable-stream` for reconnectable SSE.

**Ingestion pipeline** (`scripts/ingest.ts`, stages `FETCH → CHUNK → EMBED → STORE → READY`):
pull a YouTube transcript via `@repo/transcript-scraper`, chunk into citation-aware windows
(bounded by size and time range, two-segment overlap), embed, and store. Each Qdrant point
carries `{ hearingId, videoId, title, text, startSeconds, endSeconds, startSegment,
endSegment, segmentIds }`, so retrieval keeps an exact seek range. Re-ingesting a video
replaces its points rather than duplicating. Ingest modes: `--sample 5` (a verified
five-video POC set), `--video <url>`, `--channel --limit N`.

**Workspace UX:** an indexed hearing catalog plus a synchronized workspace — YouTube on the
left, a clickable live transcript in the middle, a persistent RAG agent on the right. The
agent emits citations like `[6:46](#t=406)` that route through the same player-seek function
as transcript rows.

**Validation:** `bun run typecheck` / `lint` / `build`; the end-to-end flow was smoke-tested
with a live YouTube transcript (355 timed SQLite segments, 40 Qdrant points, browser
transcript seeking, persistent threads). Real agent generation requires a configured model key.

## 4. Configuration

`rag-hor` has its own `.env.example` (`AI_GATEWAY_API_KEY`, optional `EXA_API_KEY`,
`CHAT_MODEL`/`EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS` overrides) and requires Docker for its
Qdrant + Redis infrastructure (`bun run infra:up`). eGov credentials, when the eGov subagents
are wired, come from the root `.env.sample` (see the [eGov API reference](../../../docs/architecture.md) §5).

## 5. Gaps between what's built and the target

Built today: transcription (`transcript-scraper`), the eGov SDK (shared), and the `rag-hor`
product — ingestion, timestamp-grounded RAG over the hearing transcript, a `ToolLoopAgent`
with transcript/web tools, and the synchronized workspace UI. Remaining work:

1. **eGov AI refinement middleware** — wire `ai_assistant` + `translator` over transcript segments (currently raw transcript is indexed), add confidence flagging, and **cache aggressively** to respect eGov AI credits.
2. **Government-data grounding** — the core of the fact-checking thesis, not yet wired: add BetterGov Open Congress, the Juris.ph MCP, and the Compass SDK so claims are cross-referenced against legislative/legal/budget records rather than only the hearing's own transcript.
3. **eve migration + fact-checker** — move orchestration to eve (Vercel) and split the single `ToolLoopAgent` into the specialized subagents that route claims and aggregate verdicts (§2).
4. **Views** — agenda calendar (schedule scraped from `congress.gov.ph/committees/committee-meetings`, joined to BetterGov committee data) and the legislative-data explorer (BetterGov API).
5. **Productionization** — validate the configured eGov gateway contracts; add eGov credit monitoring (`getTokenCredits`) and adapter-level retries for the undocumented endpoints (YouTube `get_panel`).
