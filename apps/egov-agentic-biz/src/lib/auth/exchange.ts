import { eGovSsoApi } from "@repo/egov/eGovSso";
import { createSession } from "@/lib/auth/session";

function requireEnvironment(name: "EGOVSSO_BASE_URL") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function exchangeEgovSsoCode(exchangeCode: string) {
  const client = eGovSsoApi.fromEnv({ baseUrl: requireEnvironment("EGOVSSO_BASE_URL") });
  const token = await client.generateAccessToken(
    { exchangeCode, scope: "SSO_AUTHENTICATION" },
    { signal: AbortSignal.timeout(12_000) },
  );
  const authentication = await client.authenticate(token.access_token, {
    signal: AbortSignal.timeout(12_000),
  });
  return await createSession(authentication.data);
}
