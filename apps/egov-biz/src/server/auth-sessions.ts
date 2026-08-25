import { eq, lte } from "drizzle-orm";
import type { EgovSsoCitizenProfile } from "egov.js";
import { getDatabase, schema } from "@/server/db";

export type StoredAuthSession = {
  expiresAt: number;
  rawProfile: EgovSsoCitizenProfile;
};

/**
 * Decode a persisted session row. Every `EgovSsoCitizenProfile` field is
 * optional, so the only thing a stored profile has to be is a JSON object;
 * anything else is a corrupt row and is reported as such by returning `null`.
 */
function parseStoredProfile(rawProfileJson: string): EgovSsoCitizenProfile | null {
  const parsed: unknown = JSON.parse(rawProfileJson);
  // `JSON.parse` only ever produces this realm's objects and arrays, so
  // `instanceof Object` rejects exactly the JSON primitives (including `null`).
  if (!(parsed instanceof Object) || Array.isArray(parsed)) return null;
  // SAFETY: `parsed` is a non-array JSON object, and every field of
  // `EgovSsoCitizenProfile` is optional, so any such object inhabits the type.
  // `storeAuthSession` below is the only writer of this column and stores the
  // eGov SSO profile verbatim.
  return parsed as EgovSsoCitizenProfile;
}

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
    const rawProfile = parseStoredProfile(row.rawProfileJson);
    if (!rawProfile) {
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
