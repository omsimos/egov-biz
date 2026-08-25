# egov-scripts

Monorepo for **Omsimos**' eGov Hackathon work: products built on the standalone
[`egov.js`](https://github.com/omsimos/egov.js) SDK plus shared data, DX, and
transcript tooling.

The flagship product is **`rag-hor`**, a fact-checked view of Philippine congressional
hearings: long-form hearing videos are transcribed with timestamps, refined, and handed
to a multi-agent RAG pipeline that grounds every claim in credible government data
(legislative records, jurisprudence, and the national budget) and returns each as
`claim → verdict → cited source → backing excerpt`. The eGov foundation is
product-agnostic — other ideas can build on the same APIs.

- **eGov API architecture & reference (shared foundation):** [`docs/architecture.md`](./docs/architecture.md)
- **Hearing project — concept, feasibility & impact:** [`apps/rag-hor/docs/research-paper.md`](./apps/rag-hor/docs/research-paper.md)
- **Hearing project — product architecture:** [`apps/rag-hor/docs/architecture.md`](./apps/rag-hor/docs/architecture.md)

## Layout

```
egov-scripts/
├── apps/
│   ├── egov-agentic-biz/   # Agentic business-registration assistant
│   └── rag-hor/            # Next.js RAG agent for House hearings
├── packages/
│   ├── db/                 # Shared database package
│   ├── dx/                 # BNRS, LGU, and BIR business-registration flows
│   └── transcript-scraper/ # YouTube timestamped-transcript extractor
├── docs/                   # eGov API architecture & reference (shared)
├── turbo.json              # Turborepo task graph
└── .env.sample             # Service base URLs + credential slots
```

Tooling: **Bun** workspaces + **Turborepo**, with `oxfmt`/`oxlint` for formatting and
linting. Both run as Turborepo [root tasks](https://turborepo.dev/docs/guides/tools/oxc)
(`turbo run //#lint`, `turbo run //#format`) over the whole repo rather than per package,
configured in `.oxlintrc.json` and `.oxfmtrc.json`.

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- Docker (for `rag-hor` infrastructure: Qdrant + Redis)
- eGov hackathon credentials (see `.env.sample`) for the SDK, and a Vercel AI Gateway key for `rag-hor`

## Getting started

```bash
bun install
cp .env.sample .env      # fill in the eGov credentials you need
```

Root scripts (`lint` and `format` invoke oxc directly; the rest fan out through Turborepo):

| Command                                 | What it does                      |
| --------------------------------------- | --------------------------------- |
| `bun run build`                         | Build all packages/apps           |
| `bun run test`                          | Run every workspace's tests       |
| `bun run lint` / `bun run lint:fix`     | Lint the repo (oxlint) / autofix  |
| `bun run format` / `bun run format:fix` | Check formatting (oxfmt) / write  |
| `bun run check-types`                   | Type-check all workspaces         |
| `bun run dev:business`                  | Run the eGov Agentic Business app |

## Workspaces

### `apps/egov-agentic-biz` — agentic business registration

A Next.js assistant for guiding citizens through business registration using
authenticated eGov data and generated government-form artifacts.

### `apps/rag-hor` — the product

A timestamp-grounded research agent for House of Representatives video hearings:
an indexed hearing catalog plus a synchronized workspace (YouTube · live transcript ·
persistent RAG agent). Next.js 16 + React 19, AI SDK 7 `ToolLoopAgent` (agent
orchestration is moving to **eve** on Vercel), models on Vercel AI Gateway, Qdrant for
timestamp-aware vectors, SQLite for metadata/conversations, Redis for resumable
streams. Setup, ingestion, and agent details are in its own
[README](./apps/rag-hor/README.md).

### `egov.js` — eGovPH SDK

The SDK is maintained in
[`omsimos/egov.js`](https://github.com/omsimos/egov.js) and consumed from npm as
[`egov.js`](https://www.npmjs.com/package/egov.js). It provides generated clients and
types for nine eGovPH partner services from a canonical OpenAPI document.

### `packages/transcript-scraper` — transcript extraction

Dependency-free extraction of a YouTube video's public timestamped transcript to
segments + SRT. See its [README](./packages/transcript-scraper/README.md).

## Configuration

All eGov service base URLs and credential slots are declared in `.env.sample`. App
integration code fails fast when a required credential is missing. Base URLs currently target
hackathon/staging hosts (`hackathon-*.e.gov.ph`, `*.oueg.info`); promote to production
endpoints before any real deployment. Keep all credentials server-side.
