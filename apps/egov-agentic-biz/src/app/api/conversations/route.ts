import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { createConversation, listConversations } from "@/server/conversations";

export const dynamic = "force-dynamic";

const createSchema = z.object({ initialPrompt: z.string().trim().min(1).max(2_000) });

export async function GET(request: Request) {
  if (!(await readSession(request)))
    return Response.json({ error: "Authentication required." }, { status: 401 });
  return Response.json({
    conversations: await listConversations({ purpose: "registration" }),
  });
}

export async function POST(request: Request) {
  if (!(await readSession(request)))
    return Response.json({ error: "Authentication required." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Describe the business you want to start." }, { status: 400 });
  return Response.json(
    { conversation: await createConversation(parsed.data.initialPrompt) },
    { status: 201 },
  );
}
