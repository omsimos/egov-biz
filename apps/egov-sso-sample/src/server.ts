import { eGovSsoApi, type EgovSsoCitizenProfile } from "@repo/egov/eGovSso";

import { createAiFeature } from "./ai.js";

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
const aiFeature = await createAiFeature(env);

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
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        --mono: ui-monospace, "SF Mono", Menlo, "Courier New", monospace;
        --paper: #f4f1e8;
        --ink: #17171a;
        --ink-60: rgb(23 23 26 / 60%);
        --ink-40: rgb(23 23 26 / 40%);
        --ink-15: rgb(23 23 26 / 15%);
        --blue: #1f3faa;
        --red: #b3261e;
        --green: #1d6b3c;
        --amber: #8a6100;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--paper); color: var(--ink); -webkit-font-smoothing: antialiased; }
      ::selection { background: rgb(31 63 170 / 20%); }
      code { font-family: var(--mono); font-size: 0.92em; }
      main { width: min(1100px, calc(100% - 48px)); margin: 0 auto; padding-bottom: 24px; }
      .masthead { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 0 14px; border-bottom: 2px solid var(--ink); }
      .wordmark { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: -0.01em; }
      .wordmark span { color: var(--ink-60); font-weight: 500; }
      .form-no { margin: 0; color: var(--ink-60); font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
      .stamp { margin: 0; padding: 5px 12px; border: 2px solid var(--red); color: var(--red); font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; transform: rotate(-3deg); }
      .titleblock { padding: 46px 0 30px; }
      .kicker { margin: 0; color: var(--ink-60); font-family: var(--mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; }
      .titleblock h1 { margin: 12px 0 0; font-size: clamp(44px, 7vw, 84px); font-weight: 800; letter-spacing: -0.02em; line-height: 0.98; text-transform: uppercase; }
      .lede { margin: 20px 0 0; max-width: 62ch; color: var(--ink-60); font-size: 15px; line-height: 1.65; }
      .sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding: 12px 0 6px; border-top: 3px solid var(--ink); }
      .sec-title { margin: 0; font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
      .sec-no { margin-right: 10px; color: var(--ink-40); }
      .status { margin: 0; max-width: 55%; color: var(--ink-60); font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-align: right; text-transform: uppercase; }
      .status::before { content: "\\25CF\\00A0"; }
      .status[data-state="loading"] { color: var(--amber); }
      .status[data-state="loading"]::before { animation: blink 1s steps(2, start) infinite; }
      .status[data-state="success"] { color: var(--green); }
      .status[data-state="error"] { color: var(--red); }
      @keyframes blink { 50% { opacity: 0; } }
      #egov-sso-widget-button { display: flex; min-height: 48px; margin: 18px 0 6px; }
      .divider { display: flex; align-items: center; gap: 16px; margin: 22px 0 18px; color: var(--ink-40); font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.2em; text-transform: uppercase; }
      .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: var(--ink-15); }
      .exchange-form { display: grid; gap: 8px; padding-bottom: 26px; }
      .field-label { color: var(--ink-60); font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
      .exchange-row { display: flex; gap: 18px; align-items: flex-end; }
      .exchange-row input { flex: 1; min-width: 0; padding: 10px 2px; border: 0; border-bottom: 2px solid var(--ink); background: transparent; color: var(--ink); font-family: var(--mono); font-size: 15px; letter-spacing: 0.06em; transition: border-color 120ms ease, background-color 120ms ease; }
      .exchange-row input::placeholder { color: var(--ink-40); }
      .exchange-row input:focus { border-color: var(--blue); outline: none; background: rgb(31 63 170 / 5%); }
      .submit-button { padding: 12px 24px; border: 2px solid var(--ink); background: var(--ink); color: var(--paper); font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; transition: background-color 120ms ease, color 120ms ease, transform 60ms ease; }
      .submit-button:active { transform: translate(1px, 2px); }
      .exchange-help { margin: 6px 0 0; color: var(--ink-40); font-size: 12.5px; line-height: 1.6; }
      .result { counter-reset: sec 1; }
      .profile-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 30px 0 22px; }
      .profile-heading h2 { margin: 0; font-size: clamp(30px, 4.5vw, 54px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.02; text-transform: uppercase; }
      .server-message { margin: 10px 0 0; color: var(--ink-60); font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.08em; text-transform: uppercase; }
      .logout-button { flex: 0 0 auto; padding: 11px 20px; border: 2px solid var(--ink); background: transparent; color: var(--ink); font-family: var(--mono); font-size: 11.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; transition: background-color 120ms ease, color 120ms ease, transform 60ms ease; }
      .logout-button:active { transform: translate(1px, 2px); }
      .logout-button:disabled { opacity: 0.4; cursor: default; }
      .submit-button:focus-visible, .logout-button:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
      @media (hover: hover) and (pointer: fine) {
        .submit-button:hover { background: var(--paper); color: var(--ink); }
        .logout-button:hover { background: var(--ink); color: var(--paper); }
      }
      .profile-sections { margin: 0; }
      .profile-section { min-width: 0; margin: 0 0 36px; counter-increment: sec; }
      .profile-section h3 { display: flex; align-items: baseline; margin: 0; padding: 12px 0 4px; border-top: 3px solid var(--ink); font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
      .profile-section h3::before { content: counter(sec, decimal-leading-zero); margin-right: 10px; color: var(--ink-40); }
      .profile-list { display: block; margin: 6px 0 0; }
      .profile-field { display: grid; grid-template-columns: clamp(150px, 24vw, 280px) 1fr; gap: 18px; align-items: baseline; min-width: 0; padding: 11px 0; border-bottom: 1px solid var(--ink-15); }
      .profile-field dt { margin: 0; color: var(--ink-60); font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
      .profile-field dd { margin: 0; overflow-wrap: anywhere; font-size: 14.5px; line-height: 1.55; }
      .nested-list { display: block; margin: 2px 0 4px; padding-left: 16px; border-left: 2px solid var(--ink-15); }
      .nested-list .profile-field { grid-template-columns: clamp(110px, 16vw, 190px) 1fr; padding: 8px 0; border-bottom-style: dotted; }
      .nested-list .profile-field:last-child { border-bottom: 0; }
      .nested-array { display: block; margin: 2px 0 4px; padding: 0; list-style: none; }
      .nested-array > li { padding: 8px 0; }
      .nested-array > li + li { border-top: 1px dotted var(--ink-15); }
      .profile-image { display: block; width: min(100%, 200px); max-height: 170px; margin: 4px 0 2px; border: 2px solid var(--ink); background: #fff; object-fit: contain; }
      .empty-value { color: var(--ink-40); }
      .fineprint { margin-top: 40px; padding: 14px 0 0; border-top: 2px solid var(--ink); color: var(--ink-60); font-family: var(--mono); font-size: 11px; line-height: 1.8; letter-spacing: 0.03em; }
      [hidden] { display: none !important; }
      @media (prefers-reduced-motion: reduce) {
        .status[data-state="loading"]::before { animation: none; }
      }
      @media (max-width: 640px) {
        main { width: calc(100% - 36px); }
        .masthead { flex-wrap: wrap; row-gap: 10px; }
        .titleblock { padding: 30px 0 22px; }
        .sec-head { flex-direction: column; gap: 6px; }
        .status { max-width: none; text-align: left; }
        .exchange-row { flex-direction: column; align-items: stretch; }
        .profile-heading { flex-direction: column; align-items: flex-start; padding-top: 22px; }
        .profile-field, .nested-list .profile-field { grid-template-columns: 1fr; gap: 3px; }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="masthead">
        <p class="wordmark">eGovPH <span>/ Single Sign-On</span></p>
        <p class="form-no">Form No. SSO-01 · Bun runtime</p>
        <p class="stamp">Staging</p>
      </header>
      <section class="titleblock">
        <p class="kicker">eGov Hackathon · Partner Sandbox · @repo/egov/eGovSso</p>
        <h1>Citizen sign&#8209;in record</h1>
        <p class="lede">The official eGovPH widget hands a one-time exchange code to this Bun server, which resolves it into an authenticated citizen profile. Complete section 01 below; the record is filled in on success.</p>
      </section>
      <section aria-label="Authentication">
        <div class="sec-head">
          <h2 class="sec-title"><span class="sec-no">01</span>Authentication</h2>
          <p class="status" id="auth-status" data-auth-status data-state="idle">Loading the eGovPH widget…</p>
        </div>
        <div data-auth-controls>
          <div id="egov-sso-widget-button"></div>
          <div class="divider">or use a staging test code</div>
          <form class="exchange-form" data-exchange-form>
            <label class="field-label" for="exchange-code">Portal-generated exchange code</label>
            <div class="exchange-row">
              <input id="exchange-code" data-exchange-code type="password" autocomplete="off" spellcheck="false" required placeholder="XXXX-XXXX-XXXX" />
              <button class="submit-button" type="submit">Authenticate</button>
            </div>
            <p class="exchange-help">Use the API catalog’s built-in staging identity. The code is cleared immediately after submission.</p>
          </form>
        </div>
        <div class="result" data-auth-result hidden></div>
      </section>
      <footer class="fineprint">The partner secret and eGov access token stay server-side and are never rendered, persisted, or logged. An opaque HttpOnly cookie restores this record while the sample server session remains active.</footer>
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

    if (request.method === "GET" && url.pathname === "/ai") {
      return new Response(aiFeature.page(), {
        headers: noStoreHeaders("text/html; charset=utf-8"),
      });
    }

    if (request.method === "GET" && url.pathname === "/ai/client.js") {
      return new Response(aiFeature.clientScript, {
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

    if (request.method === "POST" && url.pathname === "/api/ai/chat") {
      return aiFeature.chat(request);
    }

    return Response.json({ error: "Not found." }, { status: 404 });
  },
  port,
});

console.log(`eGov SSO sample running at http://localhost:${server.port}`);
