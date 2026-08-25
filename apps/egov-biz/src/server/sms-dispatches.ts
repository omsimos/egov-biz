import { createHmac } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { EMessageApiError } from "@/lib/emessage";
import { getDatabase, schema, type Database } from "@/server/db";

export type SmsDispatchTool = "send_sms_message" | "simulate_tax_payment_reminder";

export class SmsDispatchUncertainError extends Error {
  constructor() {
    super(
      "A prior SMS dispatch may already have been accepted; it will not be retried automatically",
    );
    this.name = "SmsDispatchUncertainError";
  }
}

export class SmsDispatchRateLimitError extends Error {
  constructor() {
    super("The SMS sending limit has been reached; try again later");
    this.name = "SmsDispatchRateLimitError";
  }
}

export type SmsDispatchKey = {
  actorId: string;
  conversationId: string;
  recipient: string;
  toolName: SmsDispatchTool;
  userMessageId: string;
};

type SmsDispatchRecord = {
  outputJson: string | null;
  status: "pending" | "accepted" | "failed";
};

export type SmsDispatchRepository = {
  accept: (key: SmsDispatchKey, outputJson: string) => Promise<void>;
  fail: (key: SmsDispatchKey) => Promise<void>;
  read: (key: SmsDispatchKey) => Promise<SmsDispatchRecord | null>;
  reserve: (key: SmsDispatchKey) => Promise<boolean>;
};

function dispatchId(key: SmsDispatchKey) {
  return `${key.conversationId}:${key.userMessageId}:${key.toolName}`;
}

function recipientHash(recipient: string) {
  return createHmac("sha256", process.env.EMESSAGE_ACCESS_TOKEN || "local-egov-emessage-recipient")
    .update(recipient)
    .digest("hex");
}

function quotaBucketId(kind: string, value: string, window: string) {
  return createHmac("sha256", process.env.EMESSAGE_ACCESS_TOKEN || "local-egov-emessage-quota")
    .update(`${kind}:${value}:${window}`)
    .digest("hex");
}

function quotaIncrement(
  database: Database,
  id: string,
  maxCount: number,
  expiresAt: string,
  createdAt: string,
) {
  return database
    .insert(schema.smsQuotaBuckets)
    .values({ count: 1, createdAt, expiresAt, id, maxCount })
    .onConflictDoUpdate({
      set: { count: sql`${schema.smsQuotaBuckets.count} + 1` },
      target: schema.smsQuotaBuckets.id,
    });
}

const databaseSmsDispatchRepository: SmsDispatchRepository = {
  async reserve(key) {
    const database = await getDatabase();
    const id = dispatchId(key);
    const [existing] = await database
      .select({ id: schema.smsDispatches.id })
      .from(schema.smsDispatches)
      .where(eq(schema.smsDispatches.id, id))
      .limit(1);
    if (existing) return false;

    const nowDate = new Date();
    const hourWindow = nowDate.toISOString().slice(0, 13);
    const dayWindow = nowDate.toISOString().slice(0, 10);
    const hourExpiry = new Date(nowDate);
    hourExpiry.setUTCMinutes(60, 0, 0);
    const dayExpiry = new Date(nowDate);
    dayExpiry.setUTCHours(24, 0, 0, 0);
    const fingerprint = recipientHash(key.recipient);
    const now = new Date().toISOString();
    const reservation = database.insert(schema.smsDispatches).values({
      conversationId: key.conversationId,
      createdAt: now,
      id,
      outputJson: null,
      profileId: key.actorId,
      recipientHash: fingerprint,
      status: "pending",
      toolName: key.toolName,
      updatedAt: now,
      userMessageId: key.userMessageId,
    });
    const pruneExpired = database
      .delete(schema.smsQuotaBuckets)
      .where(lt(schema.smsQuotaBuckets.expiresAt, now));
    const actorHour = quotaIncrement(
      database,
      quotaBucketId("actor-hour", key.actorId, hourWindow),
      5,
      hourExpiry.toISOString(),
      now,
    );
    const actorDay = quotaIncrement(
      database,
      quotaBucketId("actor-day", key.actorId, dayWindow),
      20,
      dayExpiry.toISOString(),
      now,
    );
    const recipientHour = quotaIncrement(
      database,
      quotaBucketId("recipient-hour", fingerprint, hourWindow),
      3,
      hourExpiry.toISOString(),
      now,
    );

    try {
      // libSQL executes a batch as one implicit transaction. The quota bucket
      // CHECK constraint aborts and rolls back every increment plus the
      // reservation when any limit would be exceeded.
      await database.batch([pruneExpired, actorHour, actorDay, recipientHour, reservation]);
      return true;
    } catch (error) {
      const [concurrent] = await database
        .select({ id: schema.smsDispatches.id })
        .from(schema.smsDispatches)
        .where(eq(schema.smsDispatches.id, id))
        .limit(1);
      if (concurrent) return false;
      const message = error instanceof Error ? `${error.name}: ${error.message}` : "";
      if (/sms_quota_count_valid|constraint_check|check constraint/i.test(message))
        throw new SmsDispatchRateLimitError();
      throw error;
    }
  },
  async read(key) {
    const database = await getDatabase();
    const [existing] = await database
      .select({
        outputJson: schema.smsDispatches.outputJson,
        status: schema.smsDispatches.status,
      })
      .from(schema.smsDispatches)
      .where(eq(schema.smsDispatches.id, dispatchId(key)))
      .limit(1);
    return existing ?? null;
  },
  async accept(key, outputJson) {
    const database = await getDatabase();
    await database
      .update(schema.smsDispatches)
      .set({
        outputJson,
        status: "accepted",
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.smsDispatches.id, dispatchId(key)),
          eq(schema.smsDispatches.status, "pending"),
        ),
      );
  },
  async fail(key) {
    const database = await getDatabase();
    await database
      .update(schema.smsDispatches)
      .set({ status: "failed", updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(schema.smsDispatches.id, dispatchId(key)),
          eq(schema.smsDispatches.status, "pending"),
        ),
      );
  },
};

/**
 * Reserve a durable user-message/tool pair before calling eMessage. A replay
 * returns the accepted output, while concurrent or previously failed attempts
 * stay closed so the same user action cannot send twice.
 */
export async function dispatchSmsOnce<Output>(
  key: SmsDispatchKey,
  send: () => Promise<Output>,
  repository: SmsDispatchRepository = databaseSmsDispatchRepository,
): Promise<Output> {
  if (!(await repository.reserve(key))) {
    const existing = await repository.read(key);
    if (existing?.status === "accepted" && existing.outputJson) {
      // SAFETY: an `accepted` row for this key was written a few lines below by
      // `repository.accept(key, JSON.stringify(output))`, from the `send()`
      // result of the earlier call for this same tool and user message.
      return JSON.parse(existing.outputJson) as Output;
    }
    if (existing?.status === "pending") throw new SmsDispatchUncertainError();
    throw new Error("This SMS dispatch already failed; send a new message to retry");
  }

  let output: Output;
  try {
    output = await send();
  } catch (error) {
    if (error instanceof EMessageApiError && error.status >= 400 && error.status < 500) {
      await repository.fail(key);
      throw error;
    }
    throw new SmsDispatchUncertainError();
  }

  try {
    await repository.accept(key, JSON.stringify(output));
  } catch (error) {
    console.error("eMessage accepted an SMS but dispatch persistence failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return output;
}
