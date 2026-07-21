import { eGovSsoApi, type EgovSsoCitizenProfile } from "@repo/egov/eGovSso";

interface ExchangeRequest {
  exchangeCode: string;
}

interface AuthenticatedSession {
  expiresAt: number;
  message: string;
  profile: EgovSsoCitizenProfile;
}

const sessionCookieName = "egov_sso_session";
const sessions = new Map<string, AuthenticatedSession>();

const env = process.env;
const baseUrl = requireEnvironment("EGOVSSO_BASE_URL");
const clientId = requireEnvironment("EGOVSSO_PARTNER_CODE");
const port = readPort(env.EGOVSSO_SAMPLE_PORT);
const sessionTtlSeconds = readPositiveInteger(
  "EGOVSSO_SESSION_TTL_SECONDS",
  env.EGOVSSO_SESSION_TTL_SECONDS,
  3_600,
);
const eGovSsoClient = eGovSsoApi.fromEnv({ baseUrl });
const clientScript = await buildClientScript();

function requireEnvironment(name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) return 3000;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("EGOVSSO_SAMPLE_PORT must be a valid TCP port.");
  }

  return parsed;
}

function readPositiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim().length === 0) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

async function buildClientScript(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [new URL("./client.ts", import.meta.url).pathname],
    format: "iife",
    minify: true,
    target: "browser",
  });

  if (!build.success) {
    const messages = build.logs.map(({ message }) => message).join("\n");
    throw new Error(`Failed to build browser client:\n${messages}`);
  }

  const output = build.outputs[0];
  if (output === undefined) throw new Error("Bun did not produce the browser client bundle.");

  return output.text();
}

function page(): string {
  const escapedClientId = escapeHtmlAttribute(clientId);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="egov-environment" content="STAGING" />
    <meta name="egov-client-id" content="${escapedClientId}" />
    <meta name="egov-sso-onsuccess" content="handleEgovSsoSuccess" />
    <title>eGov SSO Sample</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #f3f6fb; color: #172033; }
      main { width: min(1120px, calc(100% - 32px)); margin: 64px auto; }
      .eyebrow { margin: 0 0 10px; color: #315ba9; font-size: 13px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(32px, 7vw, 52px); letter-spacing: -.04em; line-height: 1; }
      .lede { margin: 18px 0 0; max-width: 560px; color: #59657a; font-size: 17px; line-height: 1.65; }
      .card { margin-top: 32px; padding: 28px; border: 1px solid #d9e0eb; border-radius: 20px; background: #fff; box-shadow: 0 18px 55px rgb(39 60 97 / 10%); }
      .status { margin: 0 0 22px; padding: 12px 14px; border-radius: 10px; background: #eef3fb; color: #40516e; font-size: 14px; }
      .status[data-state="loading"] { background: #fff6d8; color: #705500; }
      .status[data-state="success"] { background: #e3f7ea; color: #176438; }
      .status[data-state="error"] { background: #fde8e7; color: #9d2924; }
      #egov-sso-widget-button { min-height: 44px; }
      .divider { display: flex; align-items: center; gap: 12px; margin: 24px 0; color: #8a94a5; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .divider::before, .divider::after { content: ""; height: 1px; flex: 1; background: #e3e8f0; }
      .exchange-form { display: grid; gap: 10px; }
      .exchange-form label { font-size: 14px; font-weight: 700; }
      .exchange-row { display: flex; gap: 10px; }
      .exchange-row input { min-width: 0; flex: 1; padding: 11px 12px; border: 1px solid #cfd7e4; border-radius: 9px; font: inherit; }
      .exchange-row button { padding: 11px 16px; border: 0; border-radius: 9px; background: #315ba9; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      .exchange-help { margin: 0; color: #788397; font-size: 12px; line-height: 1.5; }
      .result { margin-top: 24px; padding-top: 22px; border-top: 1px solid #e3e8f0; }
      .profile-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
      .profile-heading h2 { margin: 0; font-size: 26px; }
      .result p { margin: 8px 0 0; color: #59657a; }
      .result .server-message { font-size: 13px; }
      .logout-button { flex: 0 0 auto; padding: 10px 14px; border: 1px solid #cfd7e4; border-radius: 9px; background: #fff; color: #263750; font: inherit; font-weight: 700; cursor: pointer; }
      .profile-sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 24px; }
      .profile-section { min-width: 0; padding: 18px; border: 1px solid #e1e6ee; border-radius: 14px; background: #f9fbfd; }
      .profile-section h3 { margin: 0 0 14px; color: #263750; font-size: 16px; }
      .profile-list, .nested-list { display: grid; gap: 12px; margin: 0; }
      .profile-field { min-width: 0; }
      .profile-field dt { margin: 0 0 3px; color: #788397; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
      .profile-field dd { margin: 0; overflow-wrap: anywhere; color: #263750; font-size: 14px; line-height: 1.5; }
      .nested-list { margin-top: 6px; padding: 12px; border-left: 2px solid #d9e3f2; }
      .nested-array { display: grid; gap: 10px; margin: 6px 0 0; padding: 0; list-style: none; }
      .nested-array > li { padding: 10px; border: 1px solid #e1e6ee; border-radius: 10px; background: #fff; }
      .profile-image { display: block; width: min(100%, 220px); max-height: 180px; border: 1px solid #d9e0eb; border-radius: 10px; background: #fff; object-fit: contain; }
      .empty-value { color: #8a94a5; font-style: italic; }
      .security { margin: 18px 2px 0; color: #788397; font-size: 12px; line-height: 1.55; }
      [hidden] { display: none !important; }
      @media (max-width: 620px) {
        main { margin: 32px auto; }
        .card { padding: 20px; }
        .exchange-row, .profile-heading { align-items: stretch; flex-direction: column; }
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Bun + TypeScript</p>
      <h1>eGov SSO sample</h1>
      <p class="lede">Sign in through the official staging widget. The one-time exchange code is sent directly to this Bun server, which uses <code>@repo/egov/eGovSso</code> to retrieve the authenticated profile.</p>
      <section class="card" aria-labelledby="auth-status">
        <p class="status" id="auth-status" data-auth-status data-state="idle">Loading the eGovPH widget…</p>
        <div data-auth-controls>
          <div id="egov-sso-widget-button"></div>
          <div class="divider">or use a staging test code</div>
          <form class="exchange-form" data-exchange-form>
            <label for="exchange-code">Portal-generated exchange code</label>
            <div class="exchange-row">
              <input id="exchange-code" data-exchange-code type="password" autocomplete="off" spellcheck="false" required />
              <button type="submit">Authenticate</button>
            </div>
            <p class="exchange-help">Use the API catalog’s built-in staging identity. The code is cleared immediately after submission.</p>
          </form>
        </div>
        <div class="result" data-auth-result hidden></div>
        <p class="security">The partner secret and eGov access token stay server-side and are never rendered, persisted, or logged. An opaque HttpOnly cookie restores this profile while the sample server session remains active.</p>
      </section>
    </main>
    <div id="egov-sso-widget-portal"></div>
    <script src="/client.js"></script>
    <script async defer src="https://widgets.e.gov.ph/egov-hackathon-sso-widget.js"></script>
  </body>
</html>`;
}

function noStoreHeaders(contentType: string): Headers {
  return new Headers({
    "cache-control": "no-store",
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader === null) return undefined;

  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator === -1) continue;

    const key = segment.slice(0, separator).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function sessionCookie(request: Request, sessionId: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function readSession(request: Request): AuthenticatedSession | undefined {
  const sessionId = cookieValue(request, sessionCookieName);
  if (sessionId === undefined) return undefined;

  const session = sessions.get(sessionId);
  if (session === undefined) return undefined;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return undefined;
  }

  return session;
}

function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(sessionId);
  }
}

function sessionResponse(request: Request): Response {
  const session = readSession(request);
  const headers = noStoreHeaders("application/json; charset=utf-8");

  if (session === undefined) {
    if (cookieValue(request, sessionCookieName) !== undefined) {
      headers.append("set-cookie", sessionCookie(request, "", 0));
    }

    return Response.json({ authenticated: false }, { headers });
  }

  return Response.json(
    {
      authenticated: true,
      message: session.message,
      profile: session.profile,
    },
    { headers },
  );
}

function logout(request: Request): Response {
  const sessionId = cookieValue(request, sessionCookieName);
  if (sessionId !== undefined) sessions.delete(sessionId);

  const headers = noStoreHeaders("application/json; charset=utf-8");
  headers.append("set-cookie", sessionCookie(request, "", 0));
  return new Response(null, { headers, status: 204 });
}

function isExchangeRequest(value: unknown): value is ExchangeRequest {
  if (typeof value !== "object" || value === null) return false;

  const exchangeCode = Reflect.get(value, "exchangeCode");
  return typeof exchangeCode === "string" && exchangeCode.trim().length > 0;
}

async function exchange(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    if (!isExchangeRequest(body)) {
      return Response.json({ error: "A non-empty exchangeCode is required." }, { status: 400 });
    }

    console.log("[eGov SSO sample] Exchanging one-time code on the server.");
    const token = await eGovSsoClient.generateAccessToken({
      exchangeCode: body.exchangeCode.trim(),
      scope: "SSO_AUTHENTICATION",
    });
    console.log("[eGov SSO sample] Access token issued; requesting citizen profile.");
    const authentication = await eGovSsoClient.authenticate(token.access_token);
    console.log("[eGov SSO sample] Citizen profile authenticated.");

    pruneExpiredSessions();
    const previousSessionId = cookieValue(request, sessionCookieName);
    if (previousSessionId !== undefined) sessions.delete(previousSessionId);

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      expiresAt: Date.now() + sessionTtlSeconds * 1_000,
      message: authentication.message,
      profile: authentication.data,
    });

    const headers = noStoreHeaders("application/json; charset=utf-8");
    headers.append("set-cookie", sessionCookie(request, sessionId, sessionTtlSeconds));

    return Response.json(
      {
        authenticated: true,
        message: authentication.message,
        profile: authentication.data,
      },
      { headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "SSO authentication failed.";
    console.error("[eGov SSO sample] Authentication failed:", message);
    return Response.json(
      { error: message },
      {
        headers: noStoreHeaders("application/json; charset=utf-8"),
        status: 502,
      },
    );
  }
}

const server = Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(page(), {
        headers: noStoreHeaders("text/html; charset=utf-8"),
      });
    }

    if (request.method === "GET" && url.pathname === "/client.js") {
      return new Response(clientScript, {
        headers: noStoreHeaders("text/javascript; charset=utf-8"),
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json(
        { configured: true, service: eGovSsoApi.catalog.name },
        { headers: noStoreHeaders("application/json; charset=utf-8") },
      );
    }

    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      return sessionResponse(request);
    }

    if (request.method === "POST" && url.pathname === "/api/auth/egov/exchange") {
      return exchange(request);
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      return logout(request);
    }

    return Response.json({ error: "Not found." }, { status: 404 });
  },
  port,
});

console.log(`eGov SSO sample running at http://localhost:${server.port}`);
