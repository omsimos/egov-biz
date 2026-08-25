// Turso and the shared DX file-storage adapter read their settings lazily, so a
// missing credential fails at the call site with a specific message instead of
// at import time.

function redisUrlFrom(value: string | undefined) {
  const configured = value?.trim();
  if (!configured) {
    throw new Error(
      "REDIS_URL is required for resumable AI streams; use the rediss:// connection string from Upstash, or redis://localhost:6380 with `bun run infra:up`",
    );
  }

  let protocol: string;
  try {
    protocol = new URL(configured).protocol;
  } catch {
    throw new Error("REDIS_URL must be a valid redis:// or rediss:// URL");
  }
  // Upstash also exposes KV_REST_API_URL, an HTTPS endpoint for its REST
  // client. That client cannot hold a pub/sub subscription, which
  // resumable-stream requires, so only the TCP URL works here.
  if (protocol !== "redis:" && protocol !== "rediss:") {
    throw new Error(
      `REDIS_URL must use redis:// or rediss://, not ${protocol} — the Upstash REST endpoint does not support pub/sub`,
    );
  }
  return configured;
}

export const env = {
  get redisUrl() {
    return redisUrlFrom(process.env.REDIS_URL);
  },
};
