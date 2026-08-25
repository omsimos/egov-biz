import Redis from "ioredis";
import { env } from "@/lib/env";

declare global {
  var __egovBizRedisPublisher: Redis | undefined;
  var __egovBizRedisSubscriber: Redis | undefined;
}

export function getRedisPublisher() {
  globalThis.__egovBizRedisPublisher ??= new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  return globalThis.__egovBizRedisPublisher;
}

export function getRedisSubscriber() {
  globalThis.__egovBizRedisSubscriber ??= new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  return globalThis.__egovBizRedisSubscriber;
}
