# eGOVbusiness

Register a Philippine business by answering questions in a chat. eGOVbusiness handles the
DTI business name, the local business permit and barangay clearance, and the BIR forms,
taking one payment per fee along the way. It is the Omsimos eGov Hackathon project, and it
lives in this `egov-scripts` monorepo alongside the packages it runs on.

The app is [`apps/egov-agentic-biz`](./apps/egov-agentic-biz). A citizen describes the
business they want to open, and the assistant carries it through registration end to end: a
DTI business name through BNRS, a combined LGU business permit and barangay clearance, and
BIR Forms 1901 and 1905 as filled PDFs. Payments run through eGovPay hosted checkout.
Everything the assistant asserts comes from an authenticated eGov call or a record it wrote
itself.

Everything here builds on [`egov.js`](https://github.com/omsimos/egov.js), a typed SDK for
the eGovPH partner services that is developed and versioned separately.

> [!NOTE]
> eGov partner services are reached through one gateway host,
> `https://platforms-api.e.gov.ph`, with a path per service. The values in `.env.sample` are
> the documented gateway URLs and stay environment-configurable. Running this against real
> citizen data needs the corresponding partner credentials and approval.

## Layout

```
egov-scripts/
├── apps/
│   ├── egov-agentic-biz/    # eGOVbusiness. Next.js 16, React 19, AI SDK 7
│   └── egov-stagehand-e2e/  # Browser E2E suite driving the four registration routes
├── packages/
│   ├── db/                  # Shared Turso/libSQL persistence for DX (Drizzle)
│   ├── dx/                  # BNRS, LGU, and BIR registration flows
│   ├── utils/               # BIR PDF generation and the private artifact store
│   └── transcript-scraper/  # Dependency-free YouTube transcript extractor
├── scripts/                 # One-off service probes (eMessage, eGovPay)
├── .oxlintrc.json           # Lint config, repo-wide
├── .oxfmtrc.json            # Format config, repo-wide
└── .env.sample              # Every credential slot both apps read
```

Bun workspaces and Turborepo, with [oxc](https://oxc.rs) for linting and formatting. `oxlint`
and `oxfmt` run as Turborepo [root tasks](https://turborepo.dev/docs/guides/tools/oxc) over
the whole repo in one process rather than per package.

## Prerequisites

| Requirement                   | Version                 | Needed for                                                                           |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| [Bun](https://bun.sh)         | 1.3+ (repo pins 1.3.14) | Everything. It is the package manager and the test runner                            |
| [Node.js](https://nodejs.org) | 20.12+                  | The E2E suite only, which uses `--env-file-if-exists`                                |
| Docker                        | any recent              | Local Redis, through `infra:up`                                                      |
| eGov partner credentials      |                         | `EGOVSSO_PARTNER_CODE` and `EGOVSSO_PARTNER_SECRET`, from the eGovPH partner program |

A [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key is optional. Without one the
assistant falls back to deterministic local questions and the registration flow still
completes.

## Quick start

```bash
bun install
cp .env.sample .env                            # fill in the two EGOVSSO_PARTNER_* values
bun --filter egov-agentic-biz run infra:up     # Redis on 127.0.0.1:6380
bun run dev:business                           # http://localhost:3000
```

The app database needs no setup. `TURSO_DATABASE_URL` defaults to a local SQLite file that is
created on demand, and the first query applies pending migrations.

The DX database is separate and is not migrated on demand. Initialize it once before using
the registration flow:

```bash
bun --env-file=.env --filter @repo/db db:migrate
```

Signing in needs a real eGovPH account. On loopback there is a dev session at
`/api/auth/dev-login` that skips it, which is also what the E2E suite uses.

## Environment configuration

Credentials stay server-side. The two exceptions are `EGOVSSO_BASE_URL` and
`EGOVSSO_PARTNER_CODE`, which the app renders to the browser to initialize login. The partner
secret never leaves the server. `.env.sample` documents each variable inline; this is the
summary.

| Group           | Variables                                                                                           | Required     | Without it                                                              |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| eGov SSO        | `EGOVSSO_BASE_URL`, `EGOVSSO_PARTNER_CODE`, `EGOVSSO_PARTNER_SECRET`, `EGOVSSO_SESSION_TTL_SECONDS` | Yes          | No sign-in. The loopback dev session still works                        |
| AI              | `AI_GATEWAY_API_KEY`, `CHAT_MODEL`, `EXA_API_KEY`                                                   | No           | Deterministic local intake questions instead of generated ones          |
| App database    | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`                                                            | No           | Local SQLite file, migrated on first query                              |
| DX database     | `DX_TURSO_DATABASE_URL`, `DX_TURSO_AUTH_TOKEN`                                                      | No           | `packages/db/data/egov-dx.sqlite`, migrated by hand                     |
| Redis           | `REDIS_URL`                                                                                         | Yes          | Streams cannot resume after a browser reconnect                         |
| eGovPay         | `EGOVPAY_BASE_URL`, `EGOVPAY_API_KEY`, `EGOVPAY_SETTLEMENT_TEMPLATE_UUID`, `APP_URL`                | For payments | Registration stops at the first fee                                     |
| eGovPay, LGU    | `LGU_EGOVPAY_*`                                                                                     | No           | Reuses the `EGOVPAY_*` account                                          |
| eGovPay, tunnel | `EGOVPAY_CALLBACK_URL`, `EGOVPAY_RETURN_URL`                                                        | No           | Both are derived from `APP_URL`                                         |
| eMessage        | `EMESSAGE_BASE_URL`, `EMESSAGE_ACCESS_TOKEN`                                                        | No           | No SMS delivery                                                         |
| Artifacts       | `R2_BASE_URL`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`                                                     | No           | Generated PDFs go to `FILE_STORAGE_DIRECTORY`, default `data/artifacts` |
| BIR templates   | `BIR_FORM_1901_TEMPLATE_PATH`, `BIR_FORM_1905_TEMPLATE_PATH`                                        | No           | Uses the bundled templates                                              |
| E2E             | `OPENAI_API_KEY`, `STAGEHAND_MODEL`, `E2E_BASE_URL`, `E2E_HEADLESS`, `E2E_RUN_ID`                   | No           | Defaults suffice against a local app                                    |

`.env.sample` also carries gateway URLs for eVerify, eGov AI, eGovChain, eReport, Face
Liveness, and Compass. `egov.js` covers those services, and no workspace here reads them yet.

Two settings cause more trouble than the rest.

**Redis must be a TCP URL.** On Upstash that is `REDIS_URL` (`rediss://`), never
`KV_REST_API_URL`. The REST client cannot hold a pub/sub subscription, which
`resumable-stream` requires. `src/lib/env.ts` rejects anything that is not `redis:` or
`rediss:` up front instead of failing later at connect time.

**The two databases are deliberately separate.** `@repo/db` ignores `TURSO_DATABASE_URL` and
reads only `DX_TURSO_*`, so the DX package cannot reach the app database by accident.

Deployment variables and where each comes from are in the
[app README](./apps/egov-agentic-biz/README.md).

## Scripts

Run from the repository root. `lint` and `format` call oxc directly; the rest fan out through
Turborepo.

| Command                         | What it does                                          |
| ------------------------------- | ----------------------------------------------------- |
| `bun run dev:business`          | Start eGOVbusiness on port 3000                       |
| `bun run build`                 | Build every package and app                           |
| `bun run test`                  | Run every workspace's tests                           |
| `bun run check-types`           | Type-check every workspace                            |
| `bun run lint` / `lint:fix`     | Lint the repo with oxlint, or autofix                 |
| `bun run format` / `format:fix` | Check formatting with oxfmt, or write it              |
| `bun run e2e:business`          | Run the Stagehand E2E suite against a running app     |
| `bun run demo:reset-businesses` | Clear demo business records                           |
| `bun run clean`                 | Remove `node_modules`, build output, and Turbo caches |

`bun run format` checks and `format:fix` writes, following the Turborepo oxc guide. That is
the reverse of the usual convention, so it is easy to get backwards.

Per-workspace scripts, including the database and Docker commands, live in each workspace's
README.

## Workspaces

### `apps/egov-agentic-biz`

eGOVbusiness itself. Next.js 16 with React 19, AI SDK 7 for the agent loop, Drizzle over
Turso/libSQL for durable chats, Redis pub/sub for resumable streams, and Cloudflare R2 for
generated PDFs. Its [README](./apps/egov-agentic-biz/README.md) covers local setup, schema
changes, the DX workflow boundary, and Vercel deployment.

### `apps/egov-stagehand-e2e`

Browser E2E driving four registration routes with
[Stagehand](https://github.com/browserbase/stagehand): a sole-proprietor food business, a
self-employed professional going direct to BIR, online retail, and vehicle rental. The full
food journey covers sign-in, intake, three eGovPay payments, and the post-registration chats.
Needs a running app. See its [README](./apps/egov-stagehand-e2e/README.md).

### `packages/dx`

The registration flows: `@repo/dx/bnrs` for sole-proprietorship business names,
`@repo/dx/lgu` for the combined business permit and barangay clearance, and `@repo/dx/bir`
for owner-scoped Forms 1901 and 1905. BNRS and LGU state is local and database-backed, and
payment is delegated to eGovPay. The [README](./packages/dx/README.md) documents the
application state machine.

### `packages/db`

Turso/libSQL persistence for DX, through Drizzle. Defaults to its own local database so DX
data stays separate from any application's, whatever the process working directory.
[README](./packages/db/README.md).

### `packages/utils`

`@repo/utils/bir-form` generates the BIR Form 1901 and 1905 PDFs and validates their input
schemas. `@repo/utils/files` is the private artifact store, R2 with a local directory
fallback. [README](./packages/utils/README.md).

### `packages/transcript-scraper`

Extracts the public timestamped transcript from a YouTube video as segments and SRT. No
dependencies. [README](./packages/transcript-scraper/README.md).

## Dependencies

`egov.js` is pinned at `0.2.0` and consumed from npm.

`apps/egov-agentic-biz` runs `next` 16.2.10, `react` and `react-dom` 19.2.4, `ai` 7 with
`@ai-sdk/react` 4 and `@ai-sdk/mcp` 2, `drizzle-orm` 0.45.2 over `@libsql/client`, `ioredis`
with `resumable-stream`, `zod` 4, and Tailwind 4. The interface is `@base-ui/react`,
`@phosphor-icons/react`, `motion`, `streamdown`, and `cuelume`.

`packages/dx` depends on `@repo/db`, `@repo/utils`, `drizzle-orm`, and `egov.js`.
`packages/db` on `drizzle-orm` and `@libsql/client`. `packages/utils` on
`@aws-sdk/client-s3`, `pdf-lib`, and `zod`. `packages/transcript-scraper` has none.
`apps/egov-stagehand-e2e` uses `@browserbasehq/stagehand` 3.7.1 and `zod`.

Tooling is `turbo` 2.10.5, `oxlint` 1.74.0, `oxfmt` 0.59.0, and `drizzle-kit` 0.31.10. The
packages build with TypeScript 7; the apps use TypeScript 5.

## Testing

```bash
bun run test                      # every workspace
bun run check-types               # every workspace
bun --filter @repo/dx run test    # one workspace
```

The E2E suite is separate because it drives a real browser against a running app:

```bash
bun run dev:business              # in one terminal
bun run e2e:business              # in another
```

CI runs build, types, lint, and test on pull requests, split into a workflow per area so an
unrelated package cannot gate a change. Migrations apply on push to `main`.

## Contributing

Before opening a pull request:

```bash
bun run format:fix && bun run lint && bun run check-types && bun run test
```

`.oxlintrc.json` records why each disabled rule is off. Suppress a rule inline only with a
comment explaining why, next to the `oxlint-disable-next-line`.

Commits follow Conventional Commits, scoped by area where it helps (`fix(biz):`, `chore:`).

## License

[MIT](./LICENSE).

`egov.js` is a separate project with its own license and release cycle. Nothing here is
affiliated with or endorsed by the Philippine government.
