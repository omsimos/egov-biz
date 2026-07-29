type Environment = Record<string, string | undefined>;

export type TursoConfig = {
  authToken: string | undefined;
  /** True for `file:` URLs, which are single-process and safe to migrate on boot. */
  isLocal: boolean;
  url: string;
};

const REMOTE_PROTOCOLS = new Set(["libsql:", "https:", "wss:"]);
const LOCAL_PROTOCOLS = new Set(["file:"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

function isLocalDevServer(url: URL) {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

function requiredSetting(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required to connect to the Turso database`);
  return normalized;
}

export function tursoConfig(environment: Environment = process.env): TursoConfig {
  const url = requiredSetting(environment.TURSO_DATABASE_URL, "TURSO_DATABASE_URL");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      "TURSO_DATABASE_URL must be a valid URL, such as libsql://<database>.turso.io or file:./data/egov-agentic-biz.sqlite",
    );
  }

  const protocol = parsedUrl.protocol;
  const isLocal = LOCAL_PROTOCOLS.has(protocol);
  const isLocalServer = isLocalDevServer(parsedUrl);
  if (!isLocal && !isLocalServer && !REMOTE_PROTOCOLS.has(protocol)) {
    throw new Error(
      `TURSO_DATABASE_URL protocol "${protocol}" is not supported; use libsql:, https:, wss:, file:, or http: with a loopback host`,
    );
  }

  // Local files and an explicitly loopback-only dev server need no credentials.
  // Silently accepting a token for either hides a configuration mistake.
  const authToken = environment.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!isLocal && !isLocalServer && !authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required for a remote Turso database; create one with `turso db tokens create <database>`",
    );
  }

  return { authToken: isLocal || isLocalServer ? undefined : authToken, isLocal, url };
}
