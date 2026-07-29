export type FlowConfig = {
  allowEgovPay: boolean;
  baseUrl: URL;
  businessName: string;
  headless: boolean;
  model: string;
  modelApiKey: string;
  runId: string;
};

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  if (/^(1|true|yes)$/i.test(value)) return true;
  if (/^(0|false|no)$/i.test(value)) return false;
  throw new Error(`Expected a boolean value, received ${JSON.stringify(value)}.`);
}

function safeRunId(value: string | undefined, now: Date) {
  const generated = now.toISOString().replace(/\D/g, "").slice(2, 14);
  const candidate = value?.trim() || generated;
  if (!/^[a-zA-Z0-9-]{4,32}$/.test(candidate))
    throw new Error("E2E_RUN_ID must contain 4-32 letters, digits, or hyphens.");
  return candidate;
}

function loopback(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export function readFlowConfig(
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): FlowConfig {
  const baseUrl = new URL(environment.E2E_BASE_URL?.trim() || "http://localhost:3000");
  if (!loopback(baseUrl))
    throw new Error(
      "The complete flow uses the loopback-only dev-login route. E2E_BASE_URL must target localhost.",
    );
  if (!["http:", "https:"].includes(baseUrl.protocol))
    throw new Error("E2E_BASE_URL must use http or https.");

  const allowEgovPay = booleanValue(environment.E2E_ALLOW_EGOVPAY, false);
  if (!allowEgovPay)
    throw new Error(
      "Set E2E_ALLOW_EGOVPAY=1 to acknowledge that this test creates three staging payments.",
    );
  if (
    environment.EGOVPAY_API_KEY?.trim() &&
    !environment.EGOVPAY_API_KEY.trim().startsWith("test_")
  )
    throw new Error("Refusing to run the payment journey without an eGovPay test API key.");

  const gatewayApiKey = environment.AI_GATEWAY_API_KEY?.trim();
  const openAiApiKey = environment.OPENAI_API_KEY?.trim();
  const model =
    environment.STAGEHAND_MODEL?.trim() ||
    (gatewayApiKey ? "gateway/google/gemini-2.5-flash" : "openai/gpt-4.1-mini");
  const modelApiKey = model.startsWith("gateway/") ? gatewayApiKey : openAiApiKey;
  if (!modelApiKey)
    throw new Error(
      model.startsWith("gateway/")
        ? "AI_GATEWAY_API_KEY is required for the selected Stagehand gateway model."
        : "OPENAI_API_KEY is required for the selected Stagehand model.",
    );

  const runId = safeRunId(environment.E2E_RUN_ID, now);
  return {
    allowEgovPay,
    baseUrl,
    businessName: `Stagehand Coffee Club ${runId}`,
    headless: booleanValue(environment.E2E_HEADLESS, true),
    model,
    modelApiKey,
    runId,
  };
}
