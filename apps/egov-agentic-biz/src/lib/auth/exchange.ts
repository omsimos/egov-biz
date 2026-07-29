import { createClient, egovSso } from "egov.js";
import { createSession } from "@/lib/auth/session";

type EgovSsoEnvironmentName =
  | "EGOVSSO_BASE_URL"
  | "EGOVSSO_PARTNER_CODE"
  | "EGOVSSO_PARTNER_SECRET";

function requireEnvironment(name: EgovSsoEnvironmentName) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function exchangeEgovSsoCode(exchangeCode: string) {
  const client = createClient({ baseUrl: requireEnvironment("EGOVSSO_BASE_URL") });
  const token = await egovSso.generateAccessToken({
    body: {
      exchange_code: exchangeCode,
      partner_code: requireEnvironment("EGOVSSO_PARTNER_CODE"),
      partner_secret: requireEnvironment("EGOVSSO_PARTNER_SECRET"),
      scope: "SSO_AUTHENTICATION",
    },
    client,
    signal: AbortSignal.timeout(12_000),
    throwOnError: true,
  });
  const authentication = await egovSso.authenticate({
    auth: token.access_token,
    client,
    signal: AbortSignal.timeout(12_000),
    throwOnError: true,
  });
  return await createSession(authentication.data);
}
