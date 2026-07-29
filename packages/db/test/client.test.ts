import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import {
  createDatabase,
  createDatabaseFromEnv,
  DEFAULT_DX_DATABASE_URL,
  getTursoConfig,
} from "../src/index.js";

describe("database client", () => {
  test("defaults to an isolated local DX database", () => {
    const expectedUrl = `file:${fileURLToPath(new URL("../data/egov-dx.sqlite", import.meta.url))}`;
    expect(DEFAULT_DX_DATABASE_URL).toBe(expectedUrl);
    expect(getTursoConfig({})).toEqual({
      authToken: undefined,
      isLocal: true,
      url: expectedUrl,
    });
    expect(getTursoConfig({ TURSO_DATABASE_URL: "file:./data/egov-agentic-biz.sqlite" })).toEqual({
      authToken: undefined,
      isLocal: true,
      url: expectedUrl,
    });
    expect(() => getTursoConfig({ DX_TURSO_DATABASE_URL: "postgres://localhost/db" })).toThrow(
      'protocol "postgres:" is not supported',
    );
  });

  test("requires credentials only for remote Turso", () => {
    expect(() => getTursoConfig({ DX_TURSO_DATABASE_URL: "libsql://dx.turso.io" })).toThrow(
      "DX_TURSO_AUTH_TOKEN is required",
    );
    expect(
      getTursoConfig({
        DX_TURSO_AUTH_TOKEN: " token ",
        DX_TURSO_DATABASE_URL: "  libsql://dx.turso.io  ",
      }),
    ).toEqual({ authToken: "token", isLocal: false, url: "libsql://dx.turso.io" });
    expect(
      getTursoConfig({
        DX_TURSO_AUTH_TOKEN: "ignored-locally",
        DX_TURSO_DATABASE_URL: "file::memory:",
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
      DX_TURSO_DATABASE_URL: "file::memory:",
    });

    expect(database.$client).toBeDefined();
    database.$client.close();
  });
});
