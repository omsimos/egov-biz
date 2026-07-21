import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import type { RegisteredBusiness } from "@/lib/citizen-profile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!readSession(request)) {
    return NextResponse.json(
      { error: "Authentication required." },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }

  // eGov SSO authenticates the citizen profile; it does not return registered businesses.
  // Keep this empty until an authoritative business-registry contract is integrated.
  const businesses: RegisteredBusiness[] = [];
  return NextResponse.json({ data: businesses }, { headers: { "Cache-Control": "no-store" } });
}
