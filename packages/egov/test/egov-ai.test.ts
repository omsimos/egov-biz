import { describe, expect, test } from "bun:test";

import { createEgovAiClientFromEnv, eGovAiApi, egovAiCatalog } from "../src/eGovAi/index.js";

describe("eGov AI", () => {
  test("uses EGOVAI_ACCESS_CODE for token generation", async () => {
    let capturedRequest: Request | undefined;
    const client = createEgovAiClientFromEnv({
      baseUrl: "https://ai.example.test",
      env: { EGOVAI_ACCESS_CODE: "access-code" },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ access_token: "token" });
      },
    });

    await client.generateAccessToken();

    expect(capturedRequest?.url).toBe("https://ai.example.test/api/v1/egov/integration/token");
    expect(await capturedRequest?.json()).toEqual({ access_code: "access-code" });
  });

  test("maps the authenticated generation routes and multipart document", async () => {
    const requests: Request[] = [];
    const client = createEgovAiClientFromEnv({
      baseUrl: "https://ai.example.test",
      env: { EGOVAI_ACCESS_CODE: "access-code" },
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: "result", session_id: "session" });
      },
    });
    const prompt = { category: "PH", prompt: "Question" };

    await client.generateAssistant("token", prompt);
    await client.generateSpeech("token", prompt);
    await client.generateTourism("token", prompt);
    await client.generateLawsAndRegulations("token", prompt);
    await client.translate("token", {
      prompt: "Hello",
      sourceLanguage: "en",
      targetLanguage: "fil",
    });
    await client.extractDocument("token", {
      file: new Blob(["document"], { type: "text/plain" }),
      fileName: "document.txt",
    });
    await client.getTokenCredits("token");

    expect(requests.map(({ url }) => new URL(url).pathname)).toEqual([
      "/api/v1/egov/integration/ai_assistant/generate",
      "/api/v1/egov/integration/speech_maker/generate",
      "/api/v1/egov/integration/tourism/generate",
      "/api/v1/egov/integration/laws_and_regulations/generate",
      "/api/v1/egov/integration/translator/generate",
      "/api/v1/egov/integration/document_extractor/generate",
      "/api/v1/egov/integration/credits",
    ]);
    expect(requests[5]?.headers.get("content-type")).toContain("multipart/form-data");
    expect(
      requests.every((request) => request.headers.get("authorization") === "Bearer token"),
    ).toBe(true);
  });

  test("publishes all eight endpoints and the public namespace", () => {
    expect(egovAiCatalog.endpoints).toHaveLength(8);
    expect(eGovAiApi.catalog).toBe(egovAiCatalog);
  });
});
