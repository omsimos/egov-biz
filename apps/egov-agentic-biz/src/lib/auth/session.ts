import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { mapEgovCitizenProfile } from "@/lib/auth/profile";
import {
  deleteStoredAuthSession,
  pruneStoredAuthSessions,
  readStoredAuthSession,
  storeAuthSession,
} from "@/server/auth-sessions";

export const AUTH_COOKIE_NAME = "egov_agentic_biz_session";

export type AuthenticatedSession = {
  expiresAt: number;
  id: string;
  profile: CitizenProfile;
  rawProfile: EgovSsoCitizenProfile;
};

type SessionRegistry = Map<string, AuthenticatedSession>;

const globalSessionRegistry = globalThis as typeof globalThis & {
  egovAgenticBizSessions?: SessionRegistry;
};

function sessions(): SessionRegistry {
  globalSessionRegistry.egovAgenticBizSessions ??= new Map();
  return globalSessionRegistry.egovAgenticBizSessions;
}

function sessionTtlSeconds(): number {
  const configured = process.env.EGOVSSO_SESSION_TTL_SECONDS?.trim();
  if (!configured) return 3_600;

  const parsed = Number.parseInt(configured, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 3_600;
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;

    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions()) {
    if (session.expiresAt <= now) sessions().delete(sessionId);
  }
  pruneStoredAuthSessions(now);
}

export function createSession(rawProfile: EgovSsoCitizenProfile) {
  pruneExpiredSessions();
  const sessionId = crypto.randomUUID();
  const maxAge = sessionTtlSeconds();
  const session: AuthenticatedSession = {
    expiresAt: Date.now() + maxAge * 1_000,
    id: sessionId,
    profile: mapEgovCitizenProfile(rawProfile),
    rawProfile,
  };
  storeAuthSession(sessionId, rawProfile, session.expiresAt);
  sessions().set(sessionId, session);
  return { maxAge, session, sessionId };
}

export function readSession(request: Request): AuthenticatedSession | undefined {
  const sessionId = cookieValue(request, AUTH_COOKIE_NAME);
  if (!sessionId) return undefined;

  let session = sessions().get(sessionId);
  if (!session) {
    const storedSession = readStoredAuthSession(sessionId);
    if (!storedSession) return undefined;
    session = {
      expiresAt: storedSession.expiresAt,
      id: sessionId,
      profile: mapEgovCitizenProfile(storedSession.rawProfile),
      rawProfile: storedSession.rawProfile,
    };
    sessions().set(sessionId, session);
  }
  if (session.expiresAt <= Date.now()) {
    sessions().delete(sessionId);
    deleteStoredAuthSession(sessionId);
    return undefined;
  }

  return session;
}

export function deleteSession(request: Request) {
  const sessionId = cookieValue(request, AUTH_COOKIE_NAME);
  if (sessionId) {
    sessions().delete(sessionId);
    deleteStoredAuthSession(sessionId);
  }
}

export function birFormArtifactOwnerId(session: AuthenticatedSession) {
  return session.profile.id ? `citizen:${session.profile.id}` : `session:${session.id}`;
}

export function sessionCookieOptions(request: Request, maxAge: number) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProtocol === "https" || new URL(request.url).protocol === "https:";
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}
