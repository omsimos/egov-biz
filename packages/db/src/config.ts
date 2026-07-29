import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface DatabaseEnvironment {
  DX_TURSO_AUTH_TOKEN?: string | undefined;
  DX_TURSO_DATABASE_URL?: string | undefined;
  /** Ignored so the app database cannot be selected accidentally. */
  TURSO_DATABASE_URL?: string | undefined;
}

export type TursoConfig = {
  authToken: string | undefined;
  isLocal: boolean;
  url: string;
};

const REMOTE_PROTOCOLS = new Set(["libsql:", "https:", "wss:"]);
export const DEFAULT_DX_DATABASE_URL = `file:${path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "egov-dx.sqlite",
)}`;

export function getTursoConfig(environment: DatabaseEnvironment = process.env): TursoConfig {
  const url = environment.DX_TURSO_DATABASE_URL?.trim() || DEFAULT_DX_DATABASE_URL;

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(
      `DX_TURSO_DATABASE_URL must be a valid libSQL or file URL, such as libsql://<database>.turso.io or ${DEFAULT_DX_DATABASE_URL}`,
    );
  }

  const isLocal = protocol === "file:";
  if (!isLocal && !REMOTE_PROTOCOLS.has(protocol))
    throw new Error(
      `DX_TURSO_DATABASE_URL protocol "${protocol}" is not supported; use libsql:, https:, wss:, or file:`,
    );

  const authToken = environment.DX_TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!isLocal && !authToken)
    throw new Error("DX_TURSO_AUTH_TOKEN is required to connect to a remote Turso database");

  return { authToken: isLocal ? undefined : authToken, isLocal, url };
}

export function ensureLocalDatabaseDirectory(config: TursoConfig) {
  if (!config.isLocal) return;
  const encodedPath = config.url.slice("file:".length).split("?")[0] ?? "";
  let databasePath: string;
  try {
    databasePath = decodeURIComponent(encodedPath);
  } catch {
    throw new Error("DX_TURSO_DATABASE_URL contains an invalid encoded file path");
  }
  if (!databasePath || databasePath === ":memory:") return;
  fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
}
