import { describe, expect, test } from "bun:test";

import {
  createEgovSsoClient,
  createEgovSsoClientFromEnv,
  egovSsoCatalog,
  SsoApi,
} from "../src/sso/index.js";

describe("eGov SSO", () => {
  test("exchanges the camel-case input for the documented token payload", async () => {
    let capturedRequest: Request | undefined;
    const client = createEgovSsoClient({
      baseUrl: "https://sso.example.test",
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ access_token: "token" });
      },
    });

    const response = await client.generateAccessToken({
      exchangeCode: "exchange-code",
      partnerCode: "partner-code",
      partnerSecret: "partner-secret",
      scope: "SSO_AUTHENTICATION",
    });

    expect(response.access_token).toBe("token");
    expect(capturedRequest?.url).toBe("https://sso.example.test/api/token");
    expect(await capturedRequest?.json()).toEqual({
      exchange_code: "exchange-code",
      partner_code: "partner-code",
      partner_secret: "partner-secret",
      scope: "SSO_AUTHENTICATION",
    });
  });

  test("authenticates with the access token and no request body", async () => {
    let capturedRequest: Request | undefined;
    const client = createEgovSsoClient({
      baseUrl: "https://sso.example.test",
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ data: {}, message: "OK", status: 200 });
      },
    });

    await client.authenticate("access-token");

    expect(capturedRequest?.url).toBe("https://sso.example.test/api/partner/sso_authentication");
    expect(capturedRequest?.headers.get("authorization")).toBe("Bearer access-token");
    expect(await capturedRequest?.text()).toBe("");
  });

  test("publishes both documented endpoints in the catalog", () => {
    expect(egovSsoCatalog.endpoints.map(({ id }) => id)).toEqual([
      "generate-access-token",
      "sso-authentication",
    ]);
    expect(SsoApi.catalog).toBe(egovSsoCatalog);
  });

  test("binds token credentials to the eGov SSO environment names", async () => {
    let capturedRequest: Request | undefined;
    const client = createEgovSsoClientFromEnv({
      baseUrl: "https://sso.example.test",
      env: {
        EGOVSSO_PARTNER_CODE: "env-partner-code",
        EGOVSSO_PARTNER_SECRET: "env-partner-secret",
      },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ access_token: "token" });
      },
    });

    await client.generateAccessToken({
      exchangeCode: "exchange-code",
      scope: "SSO_AUTHENTICATION",
    });

    expect(await capturedRequest?.json()).toEqual({
      exchange_code: "exchange-code",
      partner_code: "env-partner-code",
      partner_secret: "env-partner-secret",
      scope: "SSO_AUTHENTICATION",
    });
  });
});
