import { createDatabaseFromEnv, type Database } from "@omsimos/db";

const globalCache = globalThis as typeof globalThis & {
  __egovBizDxDatabase?: Database;
};

/** One server-only DX database connection shared by every agency composition. */
export function getDxDatabase(): Database {
  globalCache.__egovBizDxDatabase ??= createDatabaseFromEnv();
  return globalCache.__egovBizDxDatabase;
}
