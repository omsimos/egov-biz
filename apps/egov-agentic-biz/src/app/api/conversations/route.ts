import { z } from "zod";
import { createConversation, listConversations } from "@/server/conversations";

export const dynamic = "force-dynamic";

const createSchema = z.object({ initialPrompt: z.string().trim().min(1).max(2_000) });

export async function GET() {
  return Response.json({ conversations: await listConversations() });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Describe the business you want to start." }, { status: 400 });
  return Response.json(
    { conversation: await createConversation(parsed.data.initialPrompt) },
    { status: 201 },
  );
}
