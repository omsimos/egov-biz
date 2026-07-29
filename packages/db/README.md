# Database

Shared Turso/libSQL persistence for the DX BNRS and LGU packages, built with Drizzle ORM.

## Usage

Set `TURSO_DATABASE_URL` in the consuming app. A local database uses a `file:` URL and does not
need a token; a remote Turso database also requires `TURSO_AUTH_TOKEN`.

```ts
import { createDatabaseFromEnv } from "@repo/db";

const database = createDatabaseFromEnv();

// Close the underlying libSQL client during process shutdown.
database.$client.close();
```

For tests or scripts, pass the URL explicitly with `createDatabase(url, options)`.

## Schema and migrations

Add tables and relations to `src/schema.ts`, then use the package scripts from the repository
root:

```sh
bun --filter @repo/db db:generate
bun --filter @repo/db db:migrate
bun --filter @repo/db db:push
bun --filter @repo/db db:studio
```

The repository contains one fresh SQLite migration baseline in `packages/db/drizzle`. DX
migrations use the `__dx_drizzle_migrations` ledger, so these tables can share the app's Turso
database without colliding with the app's default `__drizzle_migrations` ledger.
