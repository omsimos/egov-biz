import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }

  return NextResponse.json({ data: session.profile }, { headers: { "Cache-Control": "no-store" } });
}
