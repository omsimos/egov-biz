import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;
export type PostgresOptions = NonNullable<Parameters<typeof postgres>[1]>;

export interface DatabaseEnvironment {
  DATABASE_URL?: string | undefined;
}

export function getDatabaseUrl(environment: DatabaseEnvironment = process.env): string {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL");
  }

  return databaseUrl;
}

export function createDatabase(databaseUrl: string, options?: PostgresOptions): Database {
  const client = postgres(databaseUrl, options);

  return drizzle({ client, schema });
}

export function createDatabaseFromEnv(
  environment: DatabaseEnvironment = process.env,
  options?: PostgresOptions,
): Database {
  return createDatabase(getDatabaseUrl(environment), options);
}
