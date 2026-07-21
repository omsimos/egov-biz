import { notFound } from "next/navigation";
import { HearingWorkspace } from "@/components/hearing-workspace";
import { createConversation, getConversation, listConversations } from "@/server/conversations";
import { getHearing } from "@/server/hearings";

export const dynamic = "force-dynamic";

export default async function HearingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hearing = getHearing(id);
  if (!hearing) notFound();

  let conversations = listConversations(hearing.id);
  const initialConversation = conversations[0]
    ? getConversation(conversations[0].id)!
    : createConversation(hearing.id);
  if (conversations.length === 0) conversations = [initialConversation];

  return (
    <HearingWorkspace
      hearing={hearing}
      initialConversation={initialConversation}
      initialConversations={conversations}
    />
  );
}
