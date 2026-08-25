# Database

Shared Turso/libSQL persistence for the DX BNRS and LGU packages, built with Drizzle ORM.

## Usage

The package defaults to its own local database at `packages/db/data/egov-dx.sqlite`, keeping DX
data separate from an application's database regardless of the process working directory.
Override it with `DX_TURSO_DATABASE_URL`; a remote Turso database also requires
`DX_TURSO_AUTH_TOKEN`. Generic `TURSO_DATABASE_URL` settings are ignored so the package cannot
accidentally connect to the app database.

```ts
import { createDatabaseFromEnv } from "@omsimos/db";

const database = createDatabaseFromEnv();

// Close the underlying libSQL client during process shutdown.
database.$client.close();
```

For tests or scripts, pass the URL explicitly with `createDatabase(url, options)`.

## Schema and migrations

Add tables and relations to `src/schema.ts`, then use the package scripts from the repository
root:

```sh
bun --filter @omsimos/db db:generate
bun --filter @omsimos/db db:migrate
bun --filter @omsimos/db db:push
bun --filter @omsimos/db db:studio
```

The repository contains one fresh SQLite migration baseline in `packages/db/drizzle`. DX
migrations use the `__dx_drizzle_migrations` ledger in the isolated DX database.
