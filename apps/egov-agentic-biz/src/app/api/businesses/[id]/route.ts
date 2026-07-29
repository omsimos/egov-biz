import { readSession } from "@/lib/auth/session";
import { getRegisteredBusiness } from "@/server/registered-businesses";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session)
    return Response.json(
      { error: "Authentication required." },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  const { id } = await context.params;
  const business = await getRegisteredBusiness(session.profile.id, id);
  if (!business)
    return Response.json(
      { error: "Business record not found." },
      { headers: { "Cache-Control": "no-store" }, status: 404 },
    );
  return Response.json({ data: business }, { headers: { "Cache-Control": "no-store" } });
}
