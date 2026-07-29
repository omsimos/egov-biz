import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { tursoConfig, type TursoConfig } from "@/server/db/config";
import * as schema from "@/server/db/schema";

export type Database = LibSQLDatabase<typeof schema>;

export { schema };

type DatabaseCache = {
  client: Client;
  database: Database;
  key: string;
};

// Next.js re-evaluates server modules on every hot reload. Caching on
// globalThis keeps one libSQL client per process instead of leaking a
// connection per edit, matching how the Redis clients are cached.
const globalCache = globalThis as typeof globalThis & {
  __egovBizDatabase?: DatabaseCache;
  __egovBizMigration?: Promise<void>;
};

function cacheKey(config: TursoConfig) {
  return `${config.url}\0${config.authToken ?? ""}`;
}

/**
 * libSQL will not create missing parent directories for a `file:` database, and
 * `data/` is gitignored — so a fresh clone has nowhere to put it.
 */
function ensureLocalDirectory(url: string) {
  const withoutScheme = url.slice("file:".length).split("?")[0] ?? "";
  if (!withoutScheme || withoutScheme === ":memory:") return;
  const directory = path.dirname(path.resolve(process.cwd(), withoutScheme));
  fs.mkdirSync(directory, { recursive: true });
}

function connect(config: TursoConfig): DatabaseCache {
  if (config.isLocal) ensureLocalDirectory(config.url);
  const client = createClient({
    authToken: config.authToken,
    url: config.url,
  });
  return { client, database: drizzle(client, { schema }), key: cacheKey(config) };
}

/**
 * Applies pending migrations to a local `file:` database.
 *
 * Remote databases are migrated explicitly with `bun run db:migrate` as part of
 * deploying. Serverless instances start concurrently, so migrating from a
 * request handler would race several writers against the same schema.
 */
function ensureLocalSchema(database: Database): Promise<void> {
  globalCache.__egovBizMigration ??= (async () => {
    const { migrate } = await import("drizzle-orm/libsql/migrator");
    await migrate(database, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  })().catch((error: unknown) => {
    // Allow the next call to retry instead of caching the failure forever.
    globalCache.__egovBizMigration = undefined;
    throw error;
  });
  return globalCache.__egovBizMigration;
}

export async function getDatabase(): Promise<Database> {
  const config = tursoConfig();
  const key = cacheKey(config);

  if (globalCache.__egovBizDatabase?.key !== key) {
    globalCache.__egovBizDatabase?.client.close();
    globalCache.__egovBizDatabase = connect(config);
    globalCache.__egovBizMigration = undefined;
  }

  const cached = globalCache.__egovBizDatabase;
  if (config.isLocal) await ensureLocalSchema(cached.database);
  return cached.database;
}

/** Fresh, uncached client for scripts and tests that manage their own lifecycle. */
export function createDatabase(config: TursoConfig = tursoConfig()) {
  const { client, database } = connect(config);
  return { client, database };
}
