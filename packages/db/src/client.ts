import { createClient, type Config } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import {
  ensureLocalDatabaseDirectory,
  getTursoConfig,
  type DatabaseEnvironment,
} from "./config.js";
import * as schema from "./schema.js";

export const DX_MIGRATIONS_TABLE = "__dx_drizzle_migrations";

export type Database = LibSQLDatabase<typeof schema> & {
  $client: ReturnType<typeof createClient>;
};
export type TursoOptions = Omit<Config, "url">;

export function createDatabase(url: string, options: TursoOptions = {}): Database {
  if (url.startsWith("file:"))
    ensureLocalDatabaseDirectory({ authToken: undefined, isLocal: true, url });
  const client = createClient({ ...options, url });
  return drizzle(client, { schema });
}

export function createDatabaseFromEnv(environment: DatabaseEnvironment = process.env): Database {
  const config = getTursoConfig(environment);
  return createDatabase(config.url, config.authToken ? { authToken: config.authToken } : {});
}

export function migrateDatabase(database: Database, migrationsFolder: string): Promise<void> {
  return migrate(database, {
    migrationsFolder,
    migrationsTable: DX_MIGRATIONS_TABLE,
  });
}
