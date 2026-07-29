import type { BusinessConversation } from "@/lib/business-chat";
import { readSession } from "@/lib/auth/session";
import { deleteConversation, getConversation } from "@/server/conversations";
import { getRegisteredBusiness } from "@/server/registered-businesses";

export const dynamic = "force-dynamic";

async function canAccessManagementConversation(
  profileId: string,
  conversation: BusinessConversation,
) {
  return (
    conversation.purpose !== "management" ||
    (conversation.businessId !== null &&
      (await getRegisteredBusiness(profileId, conversation.businessId)) !== null)
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const conversation = await getConversation(id);
  return conversation && (await canAccessManagementConversation(session.profile.id, conversation))
    ? Response.json({ conversation })
    : Response.json({ error: "Chat session not found" }, { status: 404 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation || !(await canAccessManagementConversation(session.profile.id, conversation)))
    return Response.json({ error: "Chat session not found" }, { status: 404 });
  return (await deleteConversation(id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Chat session not found" }, { status: 404 });
}
