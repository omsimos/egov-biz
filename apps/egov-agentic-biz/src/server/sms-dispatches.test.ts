import { describe, expect, test } from "bun:test";
import { EMessageApiError } from "@/lib/emessage";
import {
  dispatchSmsOnce,
  type SmsDispatchKey,
  type SmsDispatchRepository,
} from "@/server/sms-dispatches";

function keyId(key: SmsDispatchKey) {
  return `${key.conversationId}:${key.userMessageId}:${key.toolName}`;
}

function memoryRepository(): SmsDispatchRepository {
  const records = new Map<
    string,
    { outputJson: string | null; status: "pending" | "accepted" | "failed" }
  >();
  return {
    async reserve(key) {
      const id = keyId(key);
      if (records.has(id)) return false;
      records.set(id, { outputJson: null, status: "pending" });
      return true;
    },
    async read(key) {
      return records.get(keyId(key)) ?? null;
    },
    async accept(key, outputJson) {
      records.set(keyId(key), { outputJson, status: "accepted" });
    },
    async fail(key) {
      records.set(keyId(key), { outputJson: null, status: "failed" });
    },
  };
}

describe("SMS dispatch idempotency", () => {
  test("returns the accepted output when the same user message is replayed", async () => {
    const repository = memoryRepository();
    const key: SmsDispatchKey = {
      actorId: "profile-1",
      conversationId: "conversation-1",
      recipient: "+639170000000",
      toolName: "simulate_tax_payment_reminder",
      userMessageId: "message-1",
    };
    let sends = 0;
    const send = async () => ({ status: "accepted" as const, sends: ++sends });

    expect(await dispatchSmsOnce(key, send, repository)).toEqual({
      status: "accepted",
      sends: 1,
    });
    expect(await dispatchSmsOnce(key, send, repository)).toEqual({
      status: "accepted",
      sends: 1,
    });
    expect(sends).toBe(1);
  });

  test("does not repeat a failed dispatch for the same user message", async () => {
    const repository = memoryRepository();
    const key: SmsDispatchKey = {
      actorId: "profile-1",
      conversationId: "conversation-1",
      recipient: "+639170000000",
      toolName: "send_sms_message",
      userMessageId: "message-1",
    };
    let sends = 0;

    await expect(
      dispatchSmsOnce(
        key,
        async () => {
          sends++;
          throw new EMessageApiError({
            body: null,
            method: "POST",
            status: 422,
            statusText: "Unprocessable Entity",
            url: "https://message.example.test/messaging/v1/sms/push",
          });
        },
        repository,
      ),
    ).rejects.toThrow("422");
    await expect(
      dispatchSmsOnce(
        key,
        async () => {
          sends++;
          return { status: "accepted" };
        },
        repository,
      ),
    ).rejects.toThrow("already failed");
    expect(sends).toBe(1);
  });

  test("keeps ambiguous transport failures pending and does not retry", async () => {
    const repository = memoryRepository();
    const key: SmsDispatchKey = {
      actorId: "profile-1",
      conversationId: "conversation-1",
      recipient: "+639170000000",
      toolName: "send_sms_message",
      userMessageId: "message-1",
    };
    let sends = 0;
    const send = async () => {
      sends++;
      throw new TypeError("network connection lost");
    };

    await expect(dispatchSmsOnce(key, send, repository)).rejects.toThrow(
      "may already have been accepted",
    );
    await expect(dispatchSmsOnce(key, send, repository)).rejects.toThrow(
      "may already have been accepted",
    );
    expect(sends).toBe(1);
  });

  test("keeps provider acceptance when persistence fails", async () => {
    const repository = memoryRepository();
    repository.accept = async () => {
      throw new Error("database unavailable");
    };
    const key: SmsDispatchKey = {
      actorId: "profile-1",
      conversationId: "conversation-1",
      recipient: "+639170000000",
      toolName: "send_sms_message",
      userMessageId: "message-1",
    };
    let sends = 0;
    const send = async () => ({ status: "accepted" as const, sends: ++sends });

    expect(await dispatchSmsOnce(key, send, repository)).toEqual({
      status: "accepted",
      sends: 1,
    });
    await expect(dispatchSmsOnce(key, send, repository)).rejects.toThrow(
      "may already have been accepted",
    );
    expect(sends).toBe(1);
  });
});
