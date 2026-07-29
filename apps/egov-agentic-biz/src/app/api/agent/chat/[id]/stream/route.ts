import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { readSession } from "@/lib/auth/session";
import { getConversation, setActiveStream } from "@/server/conversations";
import { getRegisteredBusiness } from "@/server/registered-businesses";
import { getResumableContext } from "@/server/resumable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const conversation = await getConversation(id);
  if (
    conversation?.purpose === "management" &&
    (!conversation.businessId ||
      !(await getRegisteredBusiness(session.profile.id, conversation.businessId)))
  )
    return Response.json({ error: "Chat session not found." }, { status: 404 });
  if (!conversation?.activeStreamId) return new Response(null, { status: 204 });
  try {
    const resumed = await getResumableContext().resumeExistingStream(conversation.activeStreamId);
    if (!resumed) {
      await setActiveStream(id, null);
      return new Response(null, { status: 204 });
    }
    return new Response(resumed, { headers: UI_MESSAGE_STREAM_HEADERS });
  } catch (error) {
    console.error("Could not resume business chat stream", error);
    await setActiveStream(id, null);
    return new Response(null, { status: 204 });
  }
}
