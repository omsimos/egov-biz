import { readSession } from "@/lib/auth/session";
import { deleteConversation, getConversation } from "@/server/conversations";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const actor = bnrsActorFromProfile(session.rawProfile);
  const conversation = await getConversation(actor.egovUserId, id);
  return conversation
    ? Response.json({ conversation })
    : Response.json({ error: "Chat session not found" }, { status: 404 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const actor = bnrsActorFromProfile(session.rawProfile);
  const conversation = await getConversation(actor.egovUserId, id);
  if (!conversation) return Response.json({ error: "Chat session not found" }, { status: 404 });
  return (await deleteConversation(actor.egovUserId, id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Chat session not found" }, { status: 404 });
}
