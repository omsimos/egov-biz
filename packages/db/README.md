# Database

Shared PostgreSQL access for the workspace, built with Drizzle ORM and
`postgres.js`.

## Usage

Set `DATABASE_URL` in the consuming app, then create the database client:

```ts
import { createDatabaseFromEnv } from "@repo/db";

const db = createDatabaseFromEnv();

// Close the underlying postgres.js pool during process shutdown.
await db.$client.end();
```

For tests or scripts, pass the connection string explicitly with
`createDatabase(databaseUrl, options)`.

Add tables and relations to `src/schema.ts`, then use the package scripts from
the repository root:

```sh
bun --filter @repo/db db:generate
bun --filter @repo/db db:migrate
bun --filter @repo/db db:push
bun --filter @repo/db db:studio
```

`db:generate` writes versioned SQL migrations to `packages/db/drizzle`.
Commands that connect to PostgreSQL require `DATABASE_URL`.
