import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";

import { DX_MIGRATIONS_TABLE, createDatabase, migrateDatabase } from "../src/index.js";

const appMigrations = fileURLToPath(
  new URL("../../../apps/egov-agentic-biz/drizzle", import.meta.url),
);
const dxMigrations = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("database migrations", () => {
  test("applies the app and DX baselines to the same fresh libSQL database", async () => {
    const directory = mkdtempSync(join(tmpdir(), "egov-shared-turso-"));
    const database = createDatabase(pathToFileURL(join(directory, "shared.sqlite")).href);

    try {
      await migrate(database, { migrationsFolder: appMigrations });
      await migrateDatabase(database, dxMigrations);

      const result = await database.$client.execute(
        "select name from sqlite_master where type = 'table' order by name",
      );
      const tableNames = result.rows.map((row) => row.name);

      expect(tableNames).toContain("registered_businesses");
      expect(tableNames).toContain("bnrs_applications");
      expect(tableNames).toContain("lgu_applications");
      expect(tableNames).toContain("__drizzle_migrations");
      expect(tableNames).toContain(DX_MIGRATIONS_TABLE);
    } finally {
      database.$client.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
