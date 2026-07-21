import { createResumableStreamContext } from "resumable-stream/ioredis";
import { getRedisPublisher, getRedisSubscriber } from "@/server/redis";

let context: ReturnType<typeof createResumableStreamContext> | null = null;

export function getResumableContext() {
  context ??= createResumableStreamContext({
    publisher: getRedisPublisher(),
    subscriber: getRedisSubscriber(),
    keyPrefix: "egov-agentic-biz-stream",
    waitUntil: null,
  });
  return context;
}
