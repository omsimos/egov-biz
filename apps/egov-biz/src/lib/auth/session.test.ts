import { afterEach, describe, expect, mock, test } from "bun:test";
import type { EgovSsoCitizenProfile } from "egov.js";
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

const {
  AUTH_COOKIE_NAME,
  birFormArtifactOwnerId,
  createSession,
  DEFAULT_SESSION_TTL_SECONDS,
  deleteSession,
  readSession,
  sessionCookieOptions,
} = await import("@/lib/auth/session");

const globalSessionRegistry = globalThis as typeof globalThis & {
  egovAgenticBizSessions?: Map<string, unknown>;
};

const createdSessionIds: string[] = [];

function requestFor(sessionId: string) {
  return new Request("http://localhost/api/auth/session", {
    headers: { cookie: `${AUTH_COOKIE_NAME}=${sessionId}` },
  });
}

afterEach(async () => {
  for (const sessionId of createdSessionIds.splice(0)) await deleteSession(requestFor(sessionId));
  storedSessions.clear();
});

describe("authenticated session", () => {
  test("uses a seven-day default session TTL", async () => {
    const previousTtl = process.env.EGOVSSO_SESSION_TTL_SECONDS;
    delete process.env.EGOVSSO_SESSION_TTL_SECONDS;
    try {
      const { maxAge, sessionId } = await createSession({
        email: "persistent@example.test",
        first_name: "Persistent",
        last_name: "Citizen",
      } as EgovSsoCitizenProfile);
      createdSessionIds.push(sessionId);

      expect(maxAge).toBe(DEFAULT_SESSION_TTL_SECONDS);
    } finally {
      if (previousTtl === undefined) delete process.env.EGOVSSO_SESSION_TTL_SECONDS;
      else process.env.EGOVSSO_SESSION_TTL_SECONDS = previousTtl;
    }
  });

  test("restores the session from persistent storage after the process cache is cleared", async () => {
    const rawProfile = {
      email: "juan@example.test",
      first_name: "Juan",
      last_name: "Dela Cruz",
      uniqid: `session-test-${crypto.randomUUID()}`,
    } as EgovSsoCitizenProfile;
    const { sessionId } = await createSession(rawProfile);
    createdSessionIds.push(sessionId);

    globalSessionRegistry.egovAgenticBizSessions = new Map();

    expect((await readSession(requestFor(sessionId)))?.profile).toMatchObject({
      email: "juan@example.test",
      fullName: "Juan Dela Cruz",
      id: rawProfile.uniqid,
    });
    expect((await readSession(requestFor(sessionId)))?.id).toBe(sessionId);
    expect(birFormArtifactOwnerId((await readSession(requestFor(sessionId)))!)).toBe(
      `citizen:${rawProfile.uniqid}`,
    );
  });

  test("provides storage ownership even when the SSO profile has no uniqid", async () => {
    const { sessionId } = await createSession({
      email: "no-id@example.test",
      first_name: "No",
      last_name: "ID",
    } as EgovSsoCitizenProfile);
    createdSessionIds.push(sessionId);

    const session = await readSession(requestFor(sessionId));
    expect(session?.id).toBe(sessionId);
    expect(birFormArtifactOwnerId(session!)).toBe(`session:${sessionId}`);
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
