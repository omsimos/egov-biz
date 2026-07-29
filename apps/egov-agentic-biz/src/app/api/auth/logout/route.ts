import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, deleteSession, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await deleteSession(request);
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(AUTH_COOKIE_NAME, "", sessionCookieOptions(request, 0));
  return response;
}
