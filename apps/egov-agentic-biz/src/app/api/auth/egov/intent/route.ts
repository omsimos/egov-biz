import { NextResponse } from "next/server";
import {
  intentCookieOptions,
  isSameOriginRequest,
  issueSsoIntent,
  SSO_INTENT_COOKIE_NAME,
} from "@/lib/auth/intent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid login origin." }, { status: 403 });
  }

  const response = NextResponse.json({ ready: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    SSO_INTENT_COOKIE_NAME,
    await issueSsoIntent(),
    intentCookieOptions(request),
  );
  return response;
}
