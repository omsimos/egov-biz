import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, readSession, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readSession(request);
  const response = NextResponse.json(
    session
      ? { authenticated: true, profile: session.profile }
      : { authenticated: false, profile: null },
  );
  response.headers.set("Cache-Control", "no-store");
  if (!session && request.headers.get("cookie")?.includes(`${AUTH_COOKIE_NAME}=`)) {
    response.cookies.set(AUTH_COOKIE_NAME, "", sessionCookieOptions(request, 0));
  }
  return response;
}
