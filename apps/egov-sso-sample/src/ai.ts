import { eGovAiApi, type EgovAiEnvironmentClient } from "@repo/egov/eGovAi";

import { aiPage } from "./ai-page.js";

interface ChatRequest {
  message: string;
}

interface CachedAccessToken {
  accessToken: string;
  creditsRemaining: number;
  creditsTotal: number;
  expiresAt: number;
}

export interface AiFeature {
  readonly clientScript: string;
  chat(request: Request): Promise<Response>;
  page(): string;
}

const maximumMessageLength = 4_000;
const requestTimeoutMilliseconds = 60_000;
const tokenRefreshBufferMilliseconds = 60_000;
const defaultEgovAiBaseUrl = "https://egov-ai-core-ws.oueg.info";

function noStoreJsonHeaders(): Headers {
  return new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
}

function isChatRequest(value: unknown): value is ChatRequest {
  if (typeof value !== "object" || value === null) return false;
  const message = Reflect.get(value, "message");
  return (
    typeof message === "string" &&
    message.trim().length > 0 &&
    message.trim().length <= maximumMessageLength
  );
}

async function buildAiClientScript(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [new URL("./ai-client.ts", import.meta.url).pathname],
    format: "iife",
    minify: true,
    target: "browser",
  });

  if (!build.success) {
    const messages = build.logs.map(({ message }) => message).join("\n");
    throw new Error(`Failed to build AI browser client:\n${messages}`);
  }

  const output = build.outputs[0];
  if (output === undefined) throw new Error("Bun did not produce the AI browser client bundle.");

  return output.text();
}

export async function createAiFeature(
  environment: Readonly<Record<string, string | undefined>>,
): Promise<AiFeature> {
  const clientScript = await buildAiClientScript();
  let client: EgovAiEnvironmentClient | undefined;
  let cachedToken: CachedAccessToken | undefined;
  let pendingToken: Promise<CachedAccessToken> | undefined;

  function aiClient(): EgovAiEnvironmentClient {
    if (client !== undefined) return client;

    const configuredBaseUrl = environment.EGOVAI_BASE_URL?.trim();
    const baseUrl = configuredBaseUrl || defaultEgovAiBaseUrl;

    client = eGovAiApi.fromEnv({ baseUrl, env: environment });
    return client;
  }

  async function issueAccessToken(): Promise<CachedAccessToken> {
    console.log("[eGov AI sample] Requesting a short-lived access token.");
    const result = await aiClient().generateAccessToken({
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });

    const token = {
      accessToken: result.access_token,
      creditsRemaining: result.credits_remaining,
      creditsTotal: result.credits_total,
      expiresAt: Date.now() + result.expires_in_seconds * 1_000,
    } satisfies CachedAccessToken;
    cachedToken = token;
    console.log("[eGov AI sample] Access token issued.");
    return token;
  }

  async function accessToken(): Promise<CachedAccessToken> {
    if (
      cachedToken !== undefined &&
      cachedToken.expiresAt - tokenRefreshBufferMilliseconds > Date.now()
    ) {
      return cachedToken;
    }

    if (pendingToken === undefined) pendingToken = issueAccessToken();

    try {
      return await pendingToken;
    } finally {
      pendingToken = undefined;
    }
  }

  async function readCredits(token: CachedAccessToken): Promise<{
    creditsRemaining: number;
    creditsTotal: number;
  }> {
    try {
      const result = await aiClient().getTokenCredits(token.accessToken, {
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
      token.creditsRemaining = result.credits_remaining;
      token.creditsTotal = result.credits_total;
    } catch {
      console.warn("[eGov AI sample] Response received, but the credit balance was unavailable.");
    }

    return {
      creditsRemaining: token.creditsRemaining,
      creditsTotal: token.creditsTotal,
    };
  }

  async function chat(request: Request): Promise<Response> {
    try {
      const body: unknown = await request.json();
      if (!isChatRequest(body)) {
        return Response.json(
          { error: `message must contain between 1 and ${maximumMessageLength} characters.` },
          { headers: noStoreJsonHeaders(), status: 400 },
        );
      }

      const token = await accessToken();
      console.log("[eGov AI sample] Sending a PH-category prompt to the live assistant.");
      const result = await aiClient().generateAssistant(
        token.accessToken,
        { category: "PH", prompt: body.message.trim() },
        { signal: AbortSignal.timeout(requestTimeoutMilliseconds) },
      );
      const balance = await readCredits(token);
      console.log(
        `[eGov AI sample] Assistant response received; ${balance.creditsRemaining} credits remain.`,
      );

      return Response.json(
        {
          answer: result.data,
          creditsRemaining: balance.creditsRemaining,
          creditsTotal: balance.creditsTotal,
          sessionId: result.session_id,
        },
        { headers: noStoreJsonHeaders() },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown eGov AI failure";
      console.error("[eGov AI sample] Live assistant request failed:", detail);
      return Response.json(
        { error: "The live eGov AI service could not complete this request." },
        { headers: noStoreJsonHeaders(), status: 502 },
      );
    }
  }

  return { chat, clientScript, page: aiPage };
}
