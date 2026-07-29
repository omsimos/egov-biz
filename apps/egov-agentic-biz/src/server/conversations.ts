import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, like, notInArray, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import {
  latestPlanInParts,
  latestRegistrationPlan,
  planProgress,
  uniqueMessagesById,
  type BusinessChatMessage,
  type BusinessConversation,
  type ConversationPurpose,
  type ConversationSummary,
  type PlanProgress,
  type PaymentServiceType,
} from "@/lib/business-chat";
import { getDatabase, schema } from "@/server/db";

type ConversationRow = typeof schema.conversations.$inferSelect;

// `created_at` is only millisecond-precise, so rows written in the same tick can
// tie. rowid breaks the tie by insertion order, which is the order the
// transcript was actually written in.
const insertionOrder = sql`rowid`;

function titleFor(prompt: string, fallback = "New registration plan") {
  const title = prompt.replace(/\s+/g, " ").trim();
  return title.slice(0, 68) || fallback;
}

/**
 * Removes the conversation and everything hanging off it.
 *
 * The child rows are deleted explicitly rather than left to `ON DELETE CASCADE`.
 * Turso ships with foreign key enforcement off by default, and `PRAGMA
 * foreign_keys = ON` is connection-scoped, so it cannot be relied on over a
 * stateless HTTP connection. Doing it by hand behaves the same against a local
 * file and a remote database; the schema keeps the constraints as documentation.
 */
export async function deleteConversation(id: string) {
  const database = await getDatabase();
  const [, , conversation] = await database.batch([
    database.delete(schema.messages).where(eq(schema.messages.conversationId, id)),
    database.delete(schema.payments).where(eq(schema.payments.conversationId, id)),
    database.delete(schema.conversations).where(eq(schema.conversations.id, id)),
  ]);
  return conversation.rowsAffected > 0;
}

function mapSummary(
  row: ConversationRow,
  progress: PlanProgress | null = null,
): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    initialPrompt: row.initialPrompt,
    purpose: row.purpose,
    businessId: row.businessId,
    activeStreamId: row.activeStreamId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    progress,
  };
}

function progressFromParts(partsJson: string): PlanProgress | null {
  let parts: BusinessChatMessage["parts"];
  try {
    parts = JSON.parse(partsJson);
  } catch {
    return null;
  }
  const found = latestPlanInParts(parts);
  return found ? planProgress(found.plan) : null;
}

export async function listConversations(
  filter: { businessId?: string; purpose?: ConversationPurpose } = {},
): Promise<ConversationSummary[]> {
  const database = await getDatabase();
  const rows = await database
    .select()
    .from(schema.conversations)
    .where(
      and(
        filter.purpose ? eq(schema.conversations.purpose, filter.purpose) : undefined,
        filter.businessId ? eq(schema.conversations.businessId, filter.businessId) : undefined,
      ),
    )
    .orderBy(desc(schema.conversations.updatedAt));
  // One extra query for the whole list, not one per row, and the LIKE keeps it
  // to the messages that actually carry a plan — the rest of a transcript is
  // large and irrelevant here. Rows arrive oldest-first so the last write per
  // conversation wins.
  const planRows = await database
    .select({
      conversationId: schema.messages.conversationId,
      partsJson: schema.messages.partsJson,
    })
    .from(schema.messages)
    .where(like(schema.messages.partsJson, "%tool-updatePlan%"))
    .orderBy(asc(schema.messages.createdAt), insertionOrder);
  const progressById = new Map<string, PlanProgress>();
  for (const planRow of planRows) {
    const progress = progressFromParts(planRow.partsJson);
    if (progress) progressById.set(planRow.conversationId, progress);
  }
  return rows.map((row) =>
    mapSummary(row, row.purpose === "registration" ? (progressById.get(row.id) ?? null) : null),
  );
}

export async function getConversation(id: string): Promise<BusinessConversation | null> {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, id))
    .limit(1);
  if (!row) return null;

  const [payments, messageRows] = await Promise.all([
    database
      .select({ serviceType: schema.payments.serviceType, status: schema.payments.status })
      .from(schema.payments)
      .where(eq(schema.payments.conversationId, id))
      .orderBy(asc(schema.payments.createdAt), insertionOrder),
    database
      .select({
        id: schema.messages.id,
        role: schema.messages.role,
        partsJson: schema.messages.partsJson,
      })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, id))
      .orderBy(asc(schema.messages.createdAt), insertionOrder),
  ]);

  const paymentStatuses = Object.fromEntries(
    payments.map((payment) => [payment.serviceType, payment.status]),
  ) as Partial<Record<PaymentServiceType, string>>;
  const parsed = messageRows.map((message) => ({
    id: message.id,
    role: message.role,
    parts: JSON.parse(message.partsJson) as UIMessage["parts"],
  }));
  const plan = latestRegistrationPlan(parsed as Pick<BusinessChatMessage, "parts">[]);
  return {
    ...mapSummary(row, row.purpose === "registration" && plan ? planProgress(plan.plan) : null),
    paymentStatus: paymentStatuses["dti-business-name"] ?? null,
    paymentStatuses,
    messages: parsed,
  } as BusinessConversation;
}

export async function createConversation(
  initialPrompt: string,
  options: {
    businessId?: string | null;
    id?: string;
    purpose?: ConversationPurpose;
    title?: string;
  } = {},
): Promise<BusinessConversation> {
  const prompt = initialPrompt.trim();
  const id = options.id ?? randomUUID();
  const purpose = options.purpose ?? "registration";
  const now = new Date().toISOString();
  const database = await getDatabase();
  await database.insert(schema.conversations).values({
    activeStreamId: null,
    businessId: options.businessId ?? null,
    createdAt: now,
    id,
    initialPrompt: prompt,
    purpose,
    title: options.title ?? titleFor(prompt),
    updatedAt: now,
  });
  return (await getConversation(id))!;
}

export async function setActiveStream(id: string, streamId: string | null) {
  const database = await getDatabase();
  await database
    .update(schema.conversations)
    .set({ activeStreamId: streamId, updatedAt: new Date().toISOString() })
    .where(eq(schema.conversations.id, id));
}

export async function saveMessages(conversationId: string, messages: UIMessage[]) {
  const uniqueMessages = uniqueMessagesById(messages);
  const database = await getDatabase();
  const now = Date.now();

  // `batch` runs inside a single implicit libSQL transaction, so the upserts and
  // the pruning delete commit or roll back together. It replaces the previous
  // read-then-write transaction, which could not have stayed atomic across a
  // remote connection.
  const upserts = uniqueMessages.map((message, index) =>
    database
      .insert(schema.messages)
      .values({
        conversationId,
        createdAt: new Date(now + index).toISOString(),
        id: message.id,
        partsJson: JSON.stringify(message.parts),
        role: message.role,
      })
      // Deliberately leaves created_at alone so an edited message keeps its
      // original position in the transcript.
      .onConflictDoUpdate({
        set: { partsJson: sql`excluded.parts_json`, role: sql`excluded.role` },
        target: schema.messages.id,
      }),
  );

  const keptIds = uniqueMessages.map((message) => message.id);
  const prune = keptIds.length
    ? database
        .delete(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, conversationId),
            notInArray(schema.messages.id, keptIds),
          ),
        )
    : database.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId));

  const touch = database
    .update(schema.conversations)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(schema.conversations.id, conversationId));

  const firstUserText = uniqueMessages
    .filter((message) => message.role === "user")
    .flatMap((message) =>
      message.parts.filter((part) => part.type === "text").map((part) => part.text),
    )
    .find((text) => text.trim());
  const rename = firstUserText
    ? database
        .update(schema.conversations)
        .set({ title: titleFor(firstUserText, "New business chat") })
        .where(
          and(
            eq(schema.conversations.id, conversationId),
            eq(schema.conversations.purpose, "management"),
            eq(schema.conversations.title, "New business chat"),
          ),
        )
    : null;

  await database.batch([prune, touch, ...upserts, ...(rename ? [rename] : [])]);
}

export async function markPaymentCheckpointComplete(conversationId: string) {
  const conversation = await getConversation(conversationId);
  if (!conversation) return;
  let changed = false;
  for (const message of [...conversation.messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (part.type !== "tool-updatePlan" || part.state !== "output-available") continue;
      const output = part.output as {
        plan?: { title: string; steps: { id: string; label: string; status: string }[] };
      };
      if (!output.plan) continue;
      let nextActivated = false;
      output.plan.steps = output.plan.steps.map((step) => {
        if (step.id === "name-registration" || step.id === "payment")
          return { ...step, status: "completed" };
        if (!nextActivated && step.status === "pending") {
          nextActivated = true;
          return { ...step, status: "in_progress" };
        }
        return step.status === "in_progress" ? { ...step, status: "pending" } : step;
      });
      changed = true;
      break;
    }
    if (changed) break;
  }
  if (changed) await saveMessages(conversationId, conversation.messages);
}
