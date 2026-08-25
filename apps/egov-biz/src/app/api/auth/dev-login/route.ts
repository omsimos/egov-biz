import type { EgovSsoCitizenProfile } from "egov.js";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSession, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Dev-only shortcut past eGov SSO, so the agent chat can be exercised locally.
// Real login needs an email OTP and MPIN accepted by the eGov staging provider,
// which then mints a short-lived exchange code — that makes the chat flow (the
// actual product) impractical to review repeatedly during development.
//
// This mints a REAL session: same createSession, same cookie, same TTL, same
// SQLite row as a genuine login. Nothing downstream is mocked, which is the
// point — the chat, its tools, form prefill and eGovPay all behave exactly as
// they do for a real citizen. It is also precisely why this must never be
// reachable in production, hence the two guards in GET below.
//
// Companion to src/app/preview/page.tsx, which renders fixtures with no
// session; this one gives you the live app. Sign out via /api/auth/logout.

// Every field the DTI prefill reads must be non-empty: DtiFormCard renders
// null when any row is blank, so a sparse fixture would silently hide the very
// card this route exists to let you look at. See lib/form-prefill.ts.
const DEV_PROFILE: EgovSsoCitizenProfile = {
  barangay: "San Lorenzo",
  birth_date: "1994-03-12",
  email: "josh.preview@example.com",
  first_name: "Josh",
  gender: "Male",
  last_name: "Preview",
  middle_name: "Dela Cruz",
  mobile: "+63 917 000 0000",
  municipality: "Makati",
  nationality: "Filipino",
  // Left null on purpose: a non-empty photo makes the mapper point avatarUrl at
  // /api/auth/avatar, which would 404 for a fixture with no stored image.
  photo: null,
  postal: "1223",
  province: "Metro Manila",
  region: "National Capital Region",
  street: "Unit 2, 88 Ayala Avenue",
  tin_id: "123456789000",
  uniqid: "dev-josh-preview",
};

// Reads the Host header rather than new URL(request.url): Next's dev server
// reports request.url as localhost:3000 no matter how the client reached it, so
// a URL-based check can never fail and is worthless here. The Host header does
// reflect it — and it needs to, because `next dev` binds 0.0.0.0, so anyone on
// the same network can otherwise reach this route and mint a session.
function isLoopbackRequest(request: Request) {
  const host = request.headers.get("host");
  if (!host) return false;
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export async function GET(request: Request) {
  // Guard 1: absent from any production deployment, mirroring /preview.
  // Guard 2: loopback only. `next dev` binds 0.0.0.0, so without this anyone on
  // the same network could mint a session by visiting your LAN address. It is
  // also a second layer that does not depend on NODE_ENV being set correctly.
  // A same-origin check is deliberately NOT used: a typed URL sends no Origin
  // header, so it would reject the one flow this route exists to serve.
  if (process.env.NODE_ENV === "production" || !isLoopbackRequest(request)) {
    return new NextResponse(null, { status: 404 });
  }

  const { maxAge, sessionId } = await createSession(DEV_PROFILE);
  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(AUTH_COOKIE_NAME, sessionId, sessionCookieOptions(request, maxAge));
  return response;
}
