import fs from "node:fs";
import path from "node:path";
import { createClient, type Config } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema.js";

export const DX_MIGRATIONS_TABLE = "__dx_drizzle_migrations";

export type Database = LibSQLDatabase<typeof schema> & {
  $client: ReturnType<typeof createClient>;
};
export type TursoOptions = Omit<Config, "url">;

export interface DatabaseEnvironment {
  TURSO_AUTH_TOKEN?: string | undefined;
  TURSO_DATABASE_URL?: string | undefined;
}

export type TursoConfig = {
  authToken: string | undefined;
  isLocal: boolean;
  url: string;
};

const REMOTE_PROTOCOLS = new Set(["libsql:", "https:", "wss:"]);

export function getTursoConfig(environment: DatabaseEnvironment = process.env): TursoConfig {
  const url = environment.TURSO_DATABASE_URL?.trim();
  if (!url) throw new Error("TURSO_DATABASE_URL is required to connect to the DX database");

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(
      "TURSO_DATABASE_URL must be a valid libSQL or file URL, such as libsql://<database>.turso.io or file:./data/egov-agentic-biz.sqlite",
    );
  }

  const isLocal = protocol === "file:";
  if (!isLocal && !REMOTE_PROTOCOLS.has(protocol))
    throw new Error(
      `TURSO_DATABASE_URL protocol "${protocol}" is not supported; use libsql:, https:, wss:, or file:`,
    );

  const authToken = environment.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!isLocal && !authToken)
    throw new Error("TURSO_AUTH_TOKEN is required to connect to a remote Turso database");

  return { authToken: isLocal ? undefined : authToken, isLocal, url };
}

function ensureLocalDirectory(url: string) {
  const withoutScheme = url.slice("file:".length).split("?")[0] ?? "";
  if (!withoutScheme || withoutScheme === ":memory:") return;
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), withoutScheme)), { recursive: true });
}

export function createDatabase(url: string, options: TursoOptions = {}): Database {
  if (url.startsWith("file:")) ensureLocalDirectory(url);
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
