import { deleteConversation, getConversation } from "@/server/conversations";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = getConversation(id);
  return conversation ? Response.json({ conversation }) : Response.json({ error: "Chat session not found" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return deleteConversation(id) ? new Response(null, { status: 204 }) : Response.json({ error: "Chat session not found" }, { status: 404 });
}
