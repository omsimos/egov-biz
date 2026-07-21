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

export type SessionArtifact = {
  bytes: Uint8Array;
  createdAt: number;
  filename: string;
  mediaType: "application/pdf";
};

export type AuthenticatedSession = {
  artifacts: Map<string, SessionArtifact>;
  expiresAt: number;
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
    artifacts: new Map(),
    expiresAt: Date.now() + maxAge * 1_000,
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
      artifacts: new Map(),
      expiresAt: storedSession.expiresAt,
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

export function storeSessionArtifact(
  request: Request,
  artifact: Omit<SessionArtifact, "createdAt">,
) {
  const session = readSession(request);
  if (!session) return undefined;

  while (session.artifacts.size >= 5) {
    const oldest = session.artifacts.keys().next().value;
    if (typeof oldest !== "string") break;
    session.artifacts.delete(oldest);
  }

  const artifactId = crypto.randomUUID();
  session.artifacts.set(artifactId, { ...artifact, createdAt: Date.now() });
  return artifactId;
}

export function readSessionArtifact(request: Request, artifactId: string) {
  return readSession(request)?.artifacts.get(artifactId);
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
