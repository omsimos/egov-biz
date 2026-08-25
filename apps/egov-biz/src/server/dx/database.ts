import { createDatabaseFromEnv, type Database } from "@omsimos/db";

// SAFETY: the added slot is optional, so this view claims nothing about
// `globalThis` that is not already true — reading `__egovBizDxDatabase` before
// the first assignment yields `undefined`. This module is its only writer.
const globalCache = globalThis as typeof globalThis & {
  __egovBizDxDatabase?: Database;
};

/** One server-only DX database connection shared by every agency composition. */
export function getDxDatabase(): Database {
  globalCache.__egovBizDxDatabase ??= createDatabaseFromEnv();
  return globalCache.__egovBizDxDatabase;
}
