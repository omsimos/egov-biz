import { sessionCookieOptions } from "@/lib/auth/session";

export const SSO_INTENT_COOKIE_NAME = "egov_agentic_biz_sso_intent";
export const SSO_INTENT_TTL_SECONDS = 5 * 60;

function requireIntentSecret() {
  const secret = process.env.EGOVSSO_PARTNER_SECRET?.trim();
  if (!secret) throw new Error("Missing required environment variable: EGOVSSO_PARTNER_SECRET");
  return secret;
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

export async function createSsoIntentToken(
  secret: string,
  issuedAtSeconds = Math.floor(Date.now() / 1_000),
) {
  const payload = `${issuedAtSeconds}.${crypto.randomUUID().replaceAll("-", "")}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${Buffer.from(signature).toString("base64url")}`;
}

export async function verifySsoIntentToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
) {
  const [issuedAtValue, nonce, signatureValue, ...extra] = token.split(".");
  if (!issuedAtValue || !nonce || !signatureValue || extra.length > 0) return false;
  const issuedAt = Number.parseInt(issuedAtValue, 10);
  if (!Number.isSafeInteger(issuedAt)) return false;
  if (issuedAt > nowSeconds + 30 || nowSeconds - issuedAt > SSO_INTENT_TTL_SECONDS) return false;

  try {
    return await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      Buffer.from(signatureValue, "base64url"),
      new TextEncoder().encode(`${issuedAtValue}.${nonce}`),
    );
  } catch {
    return false;
  }
}

export async function issueSsoIntent() {
  return createSsoIntentToken(requireIntentSecret());
}

export async function hasValidSsoIntent(request: Request) {
  const token = cookieValue(request, SSO_INTENT_COOKIE_NAME);
  return token ? verifySsoIntentToken(token, requireIntentSecret()) : false;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export function intentCookieOptions(request: Request, maxAge = SSO_INTENT_TTL_SECONDS) {
  return sessionCookieOptions(request, maxAge);
}
