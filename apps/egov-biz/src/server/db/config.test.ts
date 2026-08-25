import { describe, expect, test } from "bun:test";
import { tursoConfig } from "@/server/db/config";

describe("tursoConfig", () => {
  test("accepts a local database file without a token", () => {
    expect(tursoConfig({ TURSO_DATABASE_URL: "file:./data/local.sqlite" })).toEqual({
      authToken: undefined,
      isLocal: true,
      url: "file:./data/local.sqlite",
    });
  });

  test.each(["localhost", "127.0.0.1", "[::1]"])(
    "accepts an unauthenticated local Turso server on %s",
    (host) => {
      expect(tursoConfig({ TURSO_DATABASE_URL: `http://${host}:8080` })).toEqual({
        authToken: undefined,
        isLocal: false,
        url: `http://${host}:8080`,
      });
    },
  );

  test("rejects unauthenticated non-loopback HTTP", () => {
    expect(() => tursoConfig({ TURSO_DATABASE_URL: "http://database.internal:8080" })).toThrow(
      'TURSO_DATABASE_URL protocol "http:" is not supported',
    );
  });

  test("requires a token for a remote Turso database", () => {
    expect(() => tursoConfig({ TURSO_DATABASE_URL: "libsql://example.turso.io" })).toThrow(
      "TURSO_AUTH_TOKEN is required",
    );
  });
});
