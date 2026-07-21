import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeEgovSsoCode } from "@/lib/auth/exchange";
import {
  hasValidSsoIntent,
  intentCookieOptions,
  isSameOriginRequest,
  SSO_INTENT_COOKIE_NAME,
} from "@/lib/auth/intent";
import { AUTH_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  exchangeCode: z.string().trim().min(1).max(512),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request) || !(await hasValidSsoIntent(request))) {
    return NextResponse.json(
      { error: "Start a fresh eGov login from this page." },
      { status: 403 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid eGov exchange code is required." }, { status: 400 });
  }

  try {
    const { maxAge, session, sessionId } = await exchangeEgovSsoCode(parsed.data.exchangeCode);
    const response = NextResponse.json({ authenticated: true, profile: session.profile });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(AUTH_COOKIE_NAME, sessionId, sessionCookieOptions(request, maxAge));
    response.cookies.set(SSO_INTENT_COOKIE_NAME, "", intentCookieOptions(request, 0));
    return response;
  } catch (error) {
    console.error("eGov SSO exchange failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "eGov SSO could not authenticate this code. Generate a fresh code and try again." },
      { headers: { "Cache-Control": "no-store" }, status: 502 },
    );
  }
}
