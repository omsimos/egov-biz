import { eq, lte } from "drizzle-orm";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import { getDatabase, schema } from "@/server/db";

export type StoredAuthSession = {
  expiresAt: number;
  rawProfile: EgovSsoCitizenProfile;
};

export async function storeAuthSession(
  sessionId: string,
  rawProfile: EgovSsoCitizenProfile,
  expiresAt: number,
) {
  const database = await getDatabase();
  await database.insert(schema.authSessions).values({
    expiresAt,
    id: sessionId,
    rawProfileJson: JSON.stringify(rawProfile),
  });
}

export async function readStoredAuthSession(
  sessionId: string,
): Promise<StoredAuthSession | undefined> {
  const database = await getDatabase();
  const [row] = await database
    .select({
      expiresAt: schema.authSessions.expiresAt,
      rawProfileJson: schema.authSessions.rawProfileJson,
    })
    .from(schema.authSessions)
    .where(eq(schema.authSessions.id, sessionId))
    .limit(1);
  if (!row) return undefined;

  try {
    const rawProfile = JSON.parse(row.rawProfileJson) as EgovSsoCitizenProfile;
    if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
      await deleteStoredAuthSession(sessionId);
      return undefined;
    }
    return { expiresAt: row.expiresAt, rawProfile };
  } catch {
    await deleteStoredAuthSession(sessionId);
    return undefined;
  }
}

export async function deleteStoredAuthSession(sessionId: string) {
  const database = await getDatabase();
  await database.delete(schema.authSessions).where(eq(schema.authSessions.id, sessionId));
}

export async function pruneStoredAuthSessions(now: number) {
  const database = await getDatabase();
  await database.delete(schema.authSessions).where(lte(schema.authSessions.expiresAt, now));
}
