import { describe, expect, test } from "bun:test";

import { createDatabase, createDatabaseFromEnv, getDatabaseUrl } from "../src/index.js";

describe("database client", () => {
  test("requires DATABASE_URL", () => {
    expect(() => getDatabaseUrl({})).toThrow("DATABASE_URL is required to connect to PostgreSQL");
    expect(() => getDatabaseUrl({ DATABASE_URL: "   " })).toThrow(
      "DATABASE_URL is required to connect to PostgreSQL",
    );
  });

  test("normalizes DATABASE_URL", () => {
    expect(
      getDatabaseUrl({ DATABASE_URL: "  postgres://postgres:postgres@localhost:5432/egov  " }),
    ).toBe("postgres://postgres:postgres@localhost:5432/egov");
  });

  test("creates a typed Drizzle client without opening a connection eagerly", async () => {
    const database = createDatabase("postgres://postgres:postgres@localhost:5432/egov", {
      max: 1,
    });

    expect(database.$client).toBeDefined();
    await database.$client.end({ timeout: 0 });
  });

  test("creates a client from an explicit environment", async () => {
    const database = createDatabaseFromEnv({
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/egov",
    });

    expect(database.$client).toBeDefined();
    await database.$client.end({ timeout: 0 });
  });
});
