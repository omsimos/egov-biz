import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import { getDatabase } from "@/server/db";

type AuthSessionRow = {
  expires_at: number;
  raw_profile_json: string;
};

export type StoredAuthSession = {
  expiresAt: number;
  rawProfile: EgovSsoCitizenProfile;
};

export function storeAuthSession(
  sessionId: string,
  rawProfile: EgovSsoCitizenProfile,
  expiresAt: number,
) {
  getDatabase()
    .prepare("INSERT INTO auth_sessions (id, raw_profile_json, expires_at) VALUES (?, ?, ?)")
    .run(sessionId, JSON.stringify(rawProfile), expiresAt);
}

export function readStoredAuthSession(sessionId: string): StoredAuthSession | undefined {
  const row = getDatabase()
    .prepare("SELECT raw_profile_json, expires_at FROM auth_sessions WHERE id = ?")
    .get(sessionId) as AuthSessionRow | undefined;
  if (!row) return undefined;

  try {
    const rawProfile = JSON.parse(row.raw_profile_json) as EgovSsoCitizenProfile;
    if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
      deleteStoredAuthSession(sessionId);
      return undefined;
    }
    return { expiresAt: row.expires_at, rawProfile };
  } catch {
    deleteStoredAuthSession(sessionId);
    return undefined;
  }
}

export function deleteStoredAuthSession(sessionId: string) {
  getDatabase().prepare("DELETE FROM auth_sessions WHERE id = ?").run(sessionId);
}

export function pruneStoredAuthSessions(now: number) {
  getDatabase().prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(now);
}
