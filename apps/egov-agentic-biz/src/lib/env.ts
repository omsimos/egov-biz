import path from "node:path";

export const env = {
  databasePath:
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "egov-agentic-biz.sqlite"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
};
