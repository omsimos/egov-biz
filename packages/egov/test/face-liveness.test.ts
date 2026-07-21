import { describe, expect, test } from "bun:test";

import {
  createFaceLivenessClientFromEnv,
  eGovFaceLivenessApi,
  faceLivenessCatalog,
} from "../src/eGovFaceLiveness/index.js";

describe("Face Liveness", () => {
  test("binds EGOVLIVENESS_API_KEY and creates a session", async () => {
    let capturedRequest: Request | undefined;
    const client = createFaceLivenessClientFromEnv({
      baseUrl: "https://liveness.example.test",
      env: { EGOVLIVENESS_API_KEY: "api-key" },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ token: "session-token", url: "https://verify.example.test" });
      },
    });

    await client.createSession({
      action: "redirect",
      callbackUrl: "https://app.example.test/callback",
      delay: 3000,
    });

    expect(capturedRequest?.url).toBe("https://liveness.example.test/v1/liveness/session");
    expect(capturedRequest?.headers.get("x-api-key")).toBe("api-key");
    expect(await capturedRequest?.json()).toEqual({
      action: "redirect",
      callback_url: "https://app.example.test/callback",
      delay: 3000,
    });
  });

  test("encodes the verification token in the result path", async () => {
    let capturedRequest: Request | undefined;
    const client = createFaceLivenessClientFromEnv({
      baseUrl: "https://liveness.example.test",
      env: { EGOVLIVENESS_API_KEY: "api-key" },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({
          confidence_score: 98.71,
          reference_image_url: "https://image.example.test/reference.jpg",
          status: "SUCCEEDED",
        });
      },
    });

    const result = await client.getVerificationResult("session/token");

    expect(result.status).toBe("SUCCEEDED");
    expect(capturedRequest?.url).toBe(
      "https://liveness.example.test/v1/liveness/result/session%2Ftoken",
    );
  });

  test("publishes both documented operations", () => {
    expect(faceLivenessCatalog.endpoints.map(({ id }) => id)).toEqual([
      "create-session",
      "get-verification-result",
    ]);
    expect(eGovFaceLivenessApi.catalog).toBe(faceLivenessCatalog);
  });
});
