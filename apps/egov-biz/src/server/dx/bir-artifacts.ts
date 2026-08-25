import { and, desc, eq } from "drizzle-orm";
import type { BirFormArtifact } from "@omsimos/dx/bir";
import { getDatabase, schema } from "@/server/db";

export type LinkedBirArtifact = {
  artifactId: string;
  createdAt: string;
  formType: "1901" | "1905";
};

export async function linkBirArtifact(input: {
  artifact: BirFormArtifact;
  conversationId: string;
  ownerEgovUserId: string;
}) {
  const database = await getDatabase();
  const [conversation] = await database
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, input.conversationId),
        eq(schema.conversations.ownerEgovUserId, input.ownerEgovUserId),
      ),
    )
    .limit(1);
  if (!conversation) throw new Error("Conversation not found.");
  const createdAt = new Date().toISOString();
  await database
    .insert(schema.conversationArtifacts)
    .values({
      artifactId: input.artifact.artifactId,
      conversationId: input.conversationId,
      createdAt,
      kind: input.artifact.formType === "1905" ? "BIR_FORM_1905" : "BIR_FORM_1901",
      ownerEgovUserId: input.ownerEgovUserId,
    })
    .onConflictDoNothing();
  return { artifactId: input.artifact.artifactId, createdAt, formType: input.artifact.formType };
}

export async function listBirArtifacts(input: {
  conversationId: string;
  ownerEgovUserId: string;
}): Promise<LinkedBirArtifact[]> {
  const database = await getDatabase();
  const rows = await database
    .select()
    .from(schema.conversationArtifacts)
    .where(
      and(
        eq(schema.conversationArtifacts.conversationId, input.conversationId),
        eq(schema.conversationArtifacts.ownerEgovUserId, input.ownerEgovUserId),
      ),
    )
    .orderBy(desc(schema.conversationArtifacts.createdAt));
  return rows.map((row) => ({
    artifactId: row.artifactId,
    createdAt: row.createdAt,
    formType: row.kind === "BIR_FORM_1905" ? "1905" : "1901",
  }));
}
