import { EgaphBusinessApp } from "@/components/egov-business-app";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedChatId = Array.isArray(query.chat) ? null : (query.chat ?? null);
  return (
    <main>
      <a className="skip-link" href="#app-content">
        Skip to content
      </a>
      <EgaphBusinessApp requestedChatId={requestedChatId} />
    </main>
  );
}
