import { EgaphBusinessApp } from "@/components/egov-business-app";
import { getConversation } from "@/server/conversations";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedChatId = typeof query.chat === "string" ? query.chat : null;
  const initialConversation = requestedChatId ? getConversation(requestedChatId) : null;
  return (
    <main>
      <a className="skip-link" href="#app-content">
        Skip to content
      </a>
      <EgaphBusinessApp
        initialConversation={initialConversation}
        requestedChatId={requestedChatId}
      />
    </main>
  );
}
