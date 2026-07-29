import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFlowConfig } from "./config.js";

const baseline = {
  E2E_ALLOW_EGOVPAY: "1",
  E2E_BASE_URL: "http://localhost:3000",
  EGOVPAY_API_KEY: "test_example",
  OPENAI_API_KEY: "example",
};

describe("Stagehand whole-flow configuration", () => {
  test("creates a stable unique business name for an acknowledged local run", () => {
    const config = readFlowConfig(baseline, new Date("2026-07-29T12:34:56.000Z"));
    assert.equal(config.businessName, "Stagehand Coffee Club 260729123456");
    assert.equal(config.headless, true);
    assert.equal(config.model, "openai/gpt-4.1-mini");
  });

  test("prefers the configured AI Gateway for semantic actions", () => {
    const config = readFlowConfig({ ...baseline, AI_GATEWAY_API_KEY: "gateway-example" });
    assert.equal(config.model, "gateway/google/gemini-2.5-flash");
    assert.equal(config.modelApiKey, "gateway-example");
  });

  test("requires an explicit staging-payment acknowledgement", () => {
    assert.throws(
      () => readFlowConfig({ ...baseline, E2E_ALLOW_EGOVPAY: "false" }),
      /E2E_ALLOW_EGOVPAY=1/,
    );
  });

  test("rejects non-test eGovPay credentials", () => {
    assert.throws(
      () => readFlowConfig({ ...baseline, EGOVPAY_API_KEY: "live_example" }),
      /eGovPay test API key/,
    );
  });

  test("keeps the dev-login flow on loopback", () => {
    assert.throws(
      () => readFlowConfig({ ...baseline, E2E_BASE_URL: "https://example.com" }),
      /must target localhost/,
    );
  });
});
