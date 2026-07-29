import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { listRegisteredBusinesses } from "@/server/registered-businesses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }

  const businesses = await listRegisteredBusinesses(session.profile.id);
  return NextResponse.json({ data: businesses }, { headers: { "Cache-Control": "no-store" } });
}
