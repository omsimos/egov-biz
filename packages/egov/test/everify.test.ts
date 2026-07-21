import { describe, expect, test } from "bun:test";

import { createEverifyClientFromEnv, eVerifyApi, everifyCatalog } from "../src/services/everify.js";

describe("eVerify", () => {
  test("binds authentication and liveness settings to eVerify env names", async () => {
    const requests: Request[] = [];
    const client = createEverifyClientFromEnv({
      baseUrl: "https://everify.example.test",
      env: {
        EVERIFY_CLIENT_ID: "client-id",
        EVERIFY_CLIENT_SECRET: "client-secret",
        EVERIFY_PUBKEY: "public-key",
      },
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({
          data: { access_token: "token", expires_at: "123", token_type: "Bearer" },
        });
      },
    });

    await client.authenticate();

    expect(client.publicKey).toBe("public-key");
    expect(await requests[0]?.json()).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
    });
  });

  test("maps all verification requests to the documented routes", async () => {
    const requests: Request[] = [];
    const client = createEverifyClientFromEnv({
      baseUrl: "https://everify.example.test",
      env: {
        EVERIFY_CLIENT_ID: "client-id",
        EVERIFY_CLIENT_SECRET: "client-secret",
        EVERIFY_PUBKEY: "public-key",
      },
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: {}, meta: {} });
      },
    });

    await client.verifyPersonalInformation("access-token", {
      birthDate: "1990-01-01",
      faceLivenessSessionId: "session-id",
      firstName: "Juan",
      lastName: "Dela Cruz",
    });
    await client.checkQr("access-token", "qr-value");
    await client.verifyQr("access-token", {
      faceLivenessSessionId: "session-id",
      value: "qr-value",
    });

    expect(requests.map(({ url }) => url)).toEqual([
      "https://everify.example.test/api/query",
      "https://everify.example.test/api/query/qr/check",
      "https://everify.example.test/api/query/qr",
    ]);
    expect(
      requests.every((request) => request.headers.get("authorization") === "Bearer access-token"),
    ).toBe(true);
  });

  test("publishes the four documented endpoints", () => {
    expect(everifyCatalog.endpoints.map(({ id }) => id)).toEqual([
      "authenticate",
      "verify-personal-information",
      "qr-check",
      "qr-verify",
    ]);
    expect(eVerifyApi.catalog).toBe(everifyCatalog);
  });
});
