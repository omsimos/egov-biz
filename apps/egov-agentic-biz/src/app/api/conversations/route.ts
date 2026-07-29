import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { createConversation, listConversations } from "@/server/conversations";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";

export const dynamic = "force-dynamic";

const createSchema = z.object({ initialPrompt: z.string().trim().min(1).max(2_000) });

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const actor = bnrsActorFromProfile(session.rawProfile);
  return Response.json({
    conversations: await listConversations(actor.egovUserId, { purpose: "registration" }),
  });
}

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Describe the business you want to start." }, { status: 400 });
  return Response.json(
    {
      conversation: await createConversation(
        bnrsActorFromProfile(session.rawProfile).egovUserId,
        parsed.data.initialPrompt,
      ),
    },
    { status: 201 },
  );
}
