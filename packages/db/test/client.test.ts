import { describe, expect, test } from "bun:test";

import { createDatabase, createDatabaseFromEnv, getTursoConfig } from "../src/index.js";

describe("database client", () => {
  test("requires a valid TURSO_DATABASE_URL", () => {
    expect(() => getTursoConfig({})).toThrow("TURSO_DATABASE_URL is required");
    expect(() => getTursoConfig({ TURSO_DATABASE_URL: "postgres://localhost/db" })).toThrow(
      'protocol "postgres:" is not supported',
    );
  });

  test("requires credentials only for remote Turso", () => {
    expect(() => getTursoConfig({ TURSO_DATABASE_URL: "libsql://dx.turso.io" })).toThrow(
      "TURSO_AUTH_TOKEN is required",
    );
    expect(
      getTursoConfig({
        TURSO_DATABASE_URL: "  libsql://dx.turso.io  ",
        TURSO_AUTH_TOKEN: " token ",
      }),
    ).toEqual({ authToken: "token", isLocal: false, url: "libsql://dx.turso.io" });
    expect(
      getTursoConfig({
        TURSO_DATABASE_URL: "file::memory:",
        TURSO_AUTH_TOKEN: "ignored-locally",
      }),
    ).toEqual({ authToken: undefined, isLocal: true, url: "file::memory:" });
  });

  test("creates a typed libSQL Drizzle client", async () => {
    const database = createDatabase("file::memory:");

    expect(database.$client).toBeDefined();
    expect(await database.$client.execute("select 1 as value")).toMatchObject({
      rows: [{ value: 1 }],
    });
    database.$client.close();
  });

  test("creates a client from an explicit environment", async () => {
    const database = createDatabaseFromEnv({
      TURSO_DATABASE_URL: "file::memory:",
    });

    expect(database.$client).toBeDefined();
    database.$client.close();
  });
});
