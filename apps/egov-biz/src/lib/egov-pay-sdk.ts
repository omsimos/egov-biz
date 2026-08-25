import { createHmac } from "node:crypto";
import { createClient } from "egov.js";

type EgovPayEnvironmentName = "EGOVPAY_API_KEY" | "EGOVPAY_SETTLEMENT_TEMPLATE_UUID";

function requireEnvironment(name: EgovPayEnvironmentName) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function createEgovPaySdk(baseUrl: string) {
  return {
    apiKey: requireEnvironment("EGOVPAY_API_KEY"),
    client: createClient({ baseUrl }),
    settlementTemplateUuid: requireEnvironment("EGOVPAY_SETTLEMENT_TEMPLATE_UUID"),
  };
}

export function createEgovPayDigest(amount: number, transactionId: string, apiKey: string) {
  const signingKey = apiKey.startsWith("test_") ? apiKey.slice(5) : apiKey;
  return createHmac("sha256", signingKey).update(`${amount}|${transactionId}`).digest("hex");
}
