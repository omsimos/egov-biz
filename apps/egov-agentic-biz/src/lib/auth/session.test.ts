import { afterEach, describe, expect, mock, test } from "bun:test";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import type { StoredAuthSession } from "@/server/auth-sessions";

const storedSessions = new Map<string, StoredAuthSession>();

mock.module("@/server/auth-sessions", () => ({
  deleteStoredAuthSession(sessionId: string) {
    storedSessions.delete(sessionId);
  },
  pruneStoredAuthSessions(now: number) {
    for (const [sessionId, session] of storedSessions) {
      if (session.expiresAt <= now) storedSessions.delete(sessionId);
    }
  },
  readStoredAuthSession(sessionId: string) {
    return storedSessions.get(sessionId);
  },
  storeAuthSession(sessionId: string, rawProfile: EgovSsoCitizenProfile, expiresAt: number) {
    storedSessions.set(sessionId, { expiresAt, rawProfile });
  },
}));

const { AUTH_COOKIE_NAME, createSession, deleteSession, readSession, sessionCookieOptions } =
  await import("@/lib/auth/session");

const globalSessionRegistry = globalThis as typeof globalThis & {
  egovAgenticBizSessions?: Map<string, unknown>;
};

const createdSessionIds: string[] = [];

function requestFor(sessionId: string) {
  return new Request("http://localhost/api/auth/session", {
    headers: { cookie: `${AUTH_COOKIE_NAME}=${sessionId}` },
  });
}

afterEach(() => {
  for (const sessionId of createdSessionIds.splice(0)) deleteSession(requestFor(sessionId));
  storedSessions.clear();
});

describe("authenticated session", () => {
  test("restores the session from persistent storage after the process cache is cleared", () => {
    const rawProfile = {
      email: "juan@example.test",
      first_name: "Juan",
      last_name: "Dela Cruz",
      uniqid: `session-test-${crypto.randomUUID()}`,
    } as EgovSsoCitizenProfile;
    const { sessionId } = createSession(rawProfile);
    createdSessionIds.push(sessionId);

    globalSessionRegistry.egovAgenticBizSessions = new Map();

    expect(readSession(requestFor(sessionId))?.profile).toMatchObject({
      email: "juan@example.test",
      fullName: "Juan Dela Cruz",
      id: rawProfile.uniqid,
    });
  });

  test("uses a persistent HttpOnly cookie", () => {
    expect(sessionCookieOptions(new Request("http://localhost"), 3_600)).toMatchObject({
      httpOnly: true,
      maxAge: 3_600,
      sameSite: "lax",
      secure: false,
    });
  });
});
