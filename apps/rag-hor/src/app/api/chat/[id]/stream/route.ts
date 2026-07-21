import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { getConversation, setActiveStream } from "@/server/conversations";
import { getResumableContext } from "@/server/resumable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation?.activeStreamId) return new Response(null, { status: 204 });

  const resumed = await getResumableContext().resumeExistingStream(conversation.activeStreamId);
  if (!resumed) {
    setActiveStream(id, null);
    return new Response(null, { status: 204 });
  }
  return new Response(resumed, { headers: UI_MESSAGE_STREAM_HEADERS });
}
