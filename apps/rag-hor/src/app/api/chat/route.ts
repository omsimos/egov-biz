import { randomUUID } from "node:crypto";
import { createAgentUIStreamResponse, type InferAgentUIMessage, type UIMessage } from "ai";
import { createHearingAgent } from "@/server/agent";
import {
  ensureConversation,
  getConversation,
  saveMessages,
  setActiveStream,
} from "@/server/conversations";
import { getHearing } from "@/server/hearings";
import { getResumableContext } from "@/server/resumable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ChatRequest {
  id?: string;
  hearingId?: string;
  messages?: UIMessage[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    if (!body.id || !body.hearingId || !Array.isArray(body.messages)) {
      return Response.json({ error: "id, hearingId, and messages are required" }, { status: 400 });
    }

    const hearing = getHearing(body.hearingId);
    if (!hearing) return Response.json({ error: "Hearing not found" }, { status: 404 });
    const conversation = ensureConversation(body.id, body.hearingId);
    if (conversation.hearingId !== body.hearingId) {
      return Response.json({ error: "Conversation does not belong to this hearing" }, { status: 409 });
    }

    saveMessages(conversation.id, body.messages);
    setActiveStream(conversation.id, null);
    const agent = createHearingAgent(hearing);
    type HearingAgentMessage = InferAgentUIMessage<typeof agent>;
    const uiMessages = body.messages as unknown as HearingAgentMessage[];

    return await createAgentUIStreamResponse({
      agent,
      uiMessages,
      originalMessages: uiMessages,
      generateMessageId: randomUUID,
      onEnd: ({ messages }) => {
        saveMessages(conversation.id, messages as unknown as UIMessage[]);
        setActiveStream(conversation.id, null);
      },
      onError: (error) => {
        console.error("Agent stream error", error);
        return error instanceof Error ? error.message : "The hearing agent could not complete this response.";
      },
      consumeSseStream: async ({ stream }) => {
        const streamId = randomUUID();
        setActiveStream(conversation.id, streamId);
        try {
          await getResumableContext().createNewResumableStream(streamId, () => stream);
        } catch (error) {
          setActiveStream(conversation.id, null);
          throw error;
        }
      },
    });
  } catch (error) {
    console.error("Chat request failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const conversation = getConversation(id);
  return conversation ? Response.json({ conversation }) : new Response(null, { status: 404 });
}
