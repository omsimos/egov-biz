import { NextResponse } from "next/server";
import { createConversation, listConversations } from "@/server/conversations";
import { getHearing } from "@/server/hearings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const hearingId = new URL(request.url).searchParams.get("hearingId");
  if (!hearingId) return NextResponse.json({ error: "hearingId is required" }, { status: 400 });
  return NextResponse.json({ conversations: listConversations(hearingId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { hearingId?: string } | null;
  if (!body?.hearingId || !getHearing(body.hearingId)) {
    return NextResponse.json({ error: "A valid hearingId is required" }, { status: 400 });
  }
  return NextResponse.json({ conversation: createConversation(body.hearingId) }, { status: 201 });
}
