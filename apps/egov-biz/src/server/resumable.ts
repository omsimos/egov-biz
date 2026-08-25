import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { getRedisPublisher, getRedisSubscriber } from "@/server/redis";

let context: ReturnType<typeof createResumableStreamContext> | null = null;

export function getResumableContext() {
  context ??= createResumableStreamContext({
    publisher: getRedisPublisher(),
    subscriber: getRedisSubscriber(),
    keyPrefix: "egov-biz-stream",
    // The model keeps producing tokens after the response headers are flushed.
    // On a serverless platform the invocation can be frozen at that point, so
    // `after` is what keeps it alive until the stream finishes writing to
    // Redis. Passing null — correct for a long-lived container — truncates
    // streams here.
    waitUntil: after,
  });
  return context;
}
