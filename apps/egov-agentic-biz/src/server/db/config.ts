type Environment = Record<string, string | undefined>;

export type TursoConfig = {
  authToken: string | undefined;
  /** True for `file:` URLs, which are single-process and safe to migrate on boot. */
  isLocal: boolean;
  url: string;
};

const REMOTE_PROTOCOLS = new Set(["libsql:", "https:", "wss:"]);
const LOCAL_PROTOCOLS = new Set(["file:"]);

function requiredSetting(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required to connect to the Turso database`);
  return normalized;
}

export function tursoConfig(environment: Environment = process.env): TursoConfig {
  const url = requiredSetting(environment.TURSO_DATABASE_URL, "TURSO_DATABASE_URL");

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(
      "TURSO_DATABASE_URL must be a valid URL, such as libsql://<database>.turso.io or file:./data/egov-agentic-biz.sqlite",
    );
  }

  const isLocal = LOCAL_PROTOCOLS.has(protocol);
  if (!isLocal && !REMOTE_PROTOCOLS.has(protocol)) {
    throw new Error(
      `TURSO_DATABASE_URL protocol "${protocol}" is not supported; use libsql:, https:, wss:, or file:`,
    );
  }

  // A local file needs no credentials, and silently accepting a token there
  // hides the mistake of pointing production config at a local database.
  const authToken = environment.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!isLocal && !authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required for a remote Turso database; create one with `turso db tokens create <database>`",
    );
  }

  return { authToken: isLocal ? undefined : authToken, isLocal, url };
}
