import Redis from "ioredis";
import { env } from "@/lib/env";

declare global {
  var __ragHorRedisPublisher: Redis | undefined;
  var __ragHorRedisSubscriber: Redis | undefined;
}

export function getRedisPublisher() {
  globalThis.__ragHorRedisPublisher ??= new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  return globalThis.__ragHorRedisPublisher;
}

export function getRedisSubscriber() {
  globalThis.__ragHorRedisSubscriber ??= new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  return globalThis.__ragHorRedisSubscriber;
}
