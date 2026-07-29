# egov-agentic-biz

Agentic business-registration prototype. Durable state lives in **Turso**
(libSQL, accessed through Drizzle), generated BIR PDFs live in **Cloudflare
R2**, and in-flight AI streams pass through **Redis** pub/sub so a browser can
reconnect mid-answer.

## Local setup

```sh
cp .env.example ../../.env   # the dev script reads the repository-root .env
bun run infra:up             # Redis on 127.0.0.1:6380
bun run dev
```

With the default `TURSO_DATABASE_URL=file:./data/egov-agentic-biz.sqlite` there
is nothing else to start: the file is created on demand and pending migrations
are applied on the first query.

BNRS and LGU state is owned by the shared DX database. It defaults to the
isolated `packages/db/data/egov-dx.sqlite`; initialize it once before using the
registration flow:

```sh
bun --env-file=.env --filter @repo/db db:migrate
```

### Running against a local libSQL server

A `file:` URL goes through the same Drizzle code path but not the same wire
protocol. To reproduce production behaviour — HTTP round trips, no shared
transactions — run the server the Turso CLI ships with:

```sh
bun run db:dev                        # libSQL server on 127.0.0.1:8080
# TURSO_DATABASE_URL=http://127.0.0.1:8080
```

It persists to the same SQLite file, so you can switch between the two.

## Schema changes

Edit `src/server/db/schema.ts`, then:

```sh
bun run db:generate    # writes versioned SQL to ./drizzle
bun run db:migrate     # applies pending migrations
bun run db:studio      # browse the data
```

Commit the generated files in `drizzle/`. `db:push` skips migration files
entirely and is only appropriate for throwaway local databases.

Migrations are applied automatically **only** for `file:` URLs, where a single
process owns the database. Remote databases are migrated explicitly, because
serverless instances start concurrently and would otherwise race several writers
against the same schema.

## Deploying to Vercel

Set these in the project (all server-side):

| Variable                                        | Where it comes from                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL`                            | `turso db show --url <database>`                                                |
| `TURSO_AUTH_TOKEN`                              | `turso db tokens create <database>`                                             |
| `DX_TURSO_DATABASE_URL`                         | URL for the separately provisioned DX database                                  |
| `DX_TURSO_AUTH_TOKEN`                           | Token for the DX database                                                       |
| `REDIS_URL`                                     | Upstash — the `rediss://` TCP URL                                               |
| `R2_BASE_URL`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` | Cloudflare R2                                                                   |
| `EMESSAGE_BASE_URL`, `EMESSAGE_ACCESS_TOKEN`    | eMessage SMS provider                                                           |
| `EMESSAGE_ALLOWED_RECIPIENTS`                   | Comma-separated verified demo/test mobile numbers; SSO mobile is always allowed |
| `EGOVPAY_BASE_URL`, `EGOVPAY_API_KEY`, `EGOVPAY_SETTLEMENT_TEMPLATE_UUID` | eGovPay checkout for BNRS and LGU; optional `LGU_EGOVPAY_*` values can override the LGU account |

Create the database once, then run `bun run db:migrate` against it as part of
releasing:

```sh
turso db create egov-agentic-biz
bun --filter egov-agentic-biz run db:migrate
```

Provision and migrate the DX database separately with the migration command in
`packages/db`. The application never creates or migrates remote DX
infrastructure at runtime.

Two things worth knowing:

- **Use Upstash's `REDIS_URL`, not `KV_REST_API_URL`.** The REST client cannot
  hold a pub/sub subscription, and `resumable-stream` requires a real
  subscriber. `src/lib/env.ts` rejects a non-`redis:`/`rediss:` URL rather than
  failing later at connect time.
- **Streams depend on `waitUntil`.** `src/server/resumable.ts` passes `after`
  from `next/server`, which keeps the invocation alive while the model finishes
  producing tokens after the response headers are flushed. Passing `null` there
  is correct for a long-lived container and truncates streams on Vercel.

## Layout

```
src/server/db/
  config.ts   # validates TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
  index.ts    # cached libSQL client, local migrate-on-boot
  schema.ts   # Drizzle table definitions
drizzle/      # generated migrations (committed)
```

Repositories in `src/server/` (`conversations` and `auth-sessions`) are the only
callers of the app's `getDatabase`. The server-only DX composition roots use
`@repo/db` separately for BNRS and LGU workflows, while DX BIR uses the shared
private artifact store. All repositories are async — libSQL is a network client
even when pointed at a file.

## DX workflow boundary

The registration path now uses the shared DX modules end to end:

1. `@repo/dx/bnrs` validates the application, owns payment state, and issues the
   business-name certificate.
2. The freshly fetched certificate is passed to `@repo/dx/lgu`, which creates
   one ₱2,500 assessment and issues the business permit and barangay clearance
   together after payment.
3. `@repo/dx/bir` generates and stores owner-scoped Forms 1901/1905.

The app does not synthesize a BIR registration, books, invoices, tax calendar,
sector permits, or employer registrations. Those remain pending until a DX
module actually supports and completes them.

One thing that will surprise you: **Turso enforces foreign keys off by default**,
and `PRAGMA foreign_keys = ON` is scoped to a connection, so it does not survive
a stateless HTTP request. A local `file:` database reports `foreign_keys = 1`,
which means `ON DELETE CASCADE` appears to work in development and silently
orphans rows in production. `deleteConversation` therefore deletes messages and
payments explicitly, in one `batch`. The constraints stay in the schema as
documentation of intent — do not rely on them to remove data.
