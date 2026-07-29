import { readSession } from "@/lib/auth/session";
import { createConversation, listConversations } from "@/server/conversations";
import { getRegisteredBusiness } from "@/server/registered-businesses";

export const dynamic = "force-dynamic";

async function ownedBusiness(request: Request, params: Promise<{ id: string }>) {
  const session = await readSession(request);
  if (!session) return { error: "Authentication required.", status: 401 } as const;
  const { id } = await params;
  const business = await getRegisteredBusiness(session.profile.id, id);
  if (!business) return { error: "Business record not found.", status: 404 } as const;
  return { business } as const;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await ownedBusiness(request, context.params);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({
    data: await listConversations({ businessId: result.business.id, purpose: "management" }),
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await ownedBusiness(request, context.params);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  const conversation = await createConversation(`Manage ${result.business.name}`, {
    businessId: result.business.id,
    purpose: "management",
    title: "New business chat",
  });
  return Response.json({ data: conversation }, { status: 201 });
}
