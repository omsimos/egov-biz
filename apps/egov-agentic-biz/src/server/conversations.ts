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
import { getBnrs } from "@/server/dx/bnrs";
import { getLgu } from "@/server/dx/lgu";
import { isPaidStatus } from "@/server/payments";

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
async function ownsConversation(ownerEgovUserId: string, id: string) {
  const database = await getDatabase();
  const [row] = await database
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function deleteConversation(ownerEgovUserId: string, id: string) {
  if (!(await ownsConversation(ownerEgovUserId, id))) return false;
  const database = await getDatabase();
  const [, , , , conversation] = await database.batch([
    database
      .delete(schema.conversationArtifacts)
      .where(eq(schema.conversationArtifacts.conversationId, id)),
    database.delete(schema.messages).where(eq(schema.messages.conversationId, id)),
    database.delete(schema.payments).where(eq(schema.payments.conversationId, id)),
    database.delete(schema.smsDispatches).where(eq(schema.smsDispatches.conversationId, id)),
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
  ownerEgovUserId: string,
  filter: { businessId?: string; purpose?: ConversationPurpose } = {},
): Promise<ConversationSummary[]> {
  const database = await getDatabase();
  const rows = await database
    .select()
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
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

export async function getConversation(
  ownerEgovUserId: string,
  id: string,
): Promise<BusinessConversation | null> {
  const database = await getDatabase();
  const [row] = await database
    .select()
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const [payments, messageRows, bnrsStatus, lguStatus] = await Promise.all([
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
    row.bnrsApplicationId
      ? getBnrs()
          .getStatus({
            actor: { egovUserId: ownerEgovUserId },
            applicationId: row.bnrsApplicationId,
          })
          .catch(() => null)
      : null,
    row.lguApplicationId
      ? getLgu()
          .getStatus({
            actor: { egovUserId: ownerEgovUserId },
            applicationId: row.lguApplicationId,
          })
          .catch(() => null)
      : null,
  ]);

  const paymentStatuses: Partial<Record<PaymentServiceType, string>> = {};
  for (const payment of payments) {
    const current = paymentStatuses[payment.serviceType];
    if (!current || !isPaidStatus(current)) paymentStatuses[payment.serviceType] = payment.status;
  }
  if (bnrsStatus?.payment)
    paymentStatuses["dti-business-name"] = bnrsStatus.payment.status.toLowerCase();
  if (lguStatus?.payment)
    paymentStatuses["lgu-business-permit"] = lguStatus.payment.status.toLowerCase();
  const parsed = messageRows.map((message) => ({
    id: message.id,
    role: message.role,
    parts: JSON.parse(message.partsJson) as UIMessage["parts"],
  }));
  const plan = latestRegistrationPlan(parsed as Pick<BusinessChatMessage, "parts">[]);
  const linkedBusinessId =
    row.businessId ??
    (row.bnrsApplicationId && row.bnrsCertificateNumber ? row.bnrsApplicationId : null);
  return {
    ...mapSummary(row, row.purpose === "registration" && plan ? planProgress(plan.plan) : null),
    businessId: linkedBusinessId,
    paymentStatus: paymentStatuses["dti-business-name"] ?? null,
    paymentStatuses,
    messages: parsed,
  } as BusinessConversation;
}

export async function createConversation(
  ownerEgovUserId: string,
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
    ownerEgovUserId,
    purpose,
    title: options.title ?? titleFor(prompt),
    updatedAt: now,
  });
  return (await getConversation(ownerEgovUserId, id))!;
}

export async function setActiveStream(
  ownerEgovUserId: string,
  id: string,
  streamId: string | null,
) {
  const database = await getDatabase();
  await database
    .update(schema.conversations)
    .set({ activeStreamId: streamId, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    );
}

export async function linkBusiness(
  ownerEgovUserId: string,
  conversationId: string,
  businessId: string,
) {
  const database = await getDatabase();
  const result = await database
    .update(schema.conversations)
    .set({ businessId, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    );
  if (result.rowsAffected === 0) throw new Error("Conversation not found.");
}

export async function saveMessages(
  ownerEgovUserId: string,
  conversationId: string,
  messages: UIMessage[],
) {
  if (!(await ownsConversation(ownerEgovUserId, conversationId)))
    throw new Error("Conversation not found.");
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
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    );

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
            eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
            eq(schema.conversations.purpose, "management"),
            eq(schema.conversations.title, "New business chat"),
          ),
        )
    : null;

  await database.batch([prune, touch, ...upserts, ...(rename ? [rename] : [])]);
}

export async function markPaymentCheckpointComplete(
  ownerEgovUserId: string,
  conversationId: string,
) {
  const conversation = await getConversation(ownerEgovUserId, conversationId);
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
  if (changed) await saveMessages(ownerEgovUserId, conversationId, conversation.messages);
}

export async function getBnrsConversationLink(ownerEgovUserId: string, conversationId: string) {
  const database = await getDatabase();
  const [row] = await database
    .select({
      applicationId: schema.conversations.bnrsApplicationId,
      certificateNumber: schema.conversations.bnrsCertificateNumber,
      transactionUuid: schema.conversations.bnrsTransactionUuid,
    })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function linkBnrsApplication(
  ownerEgovUserId: string,
  conversationId: string,
  applicationId: string,
) {
  const database = await getDatabase();
  const result = await database
    .update(schema.conversations)
    .set({ bnrsApplicationId: applicationId, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    );
  if (result.rowsAffected === 0) throw new Error("Conversation not found.");
}

export async function linkBnrsPayment(
  ownerEgovUserId: string,
  conversationId: string,
  transactionUuid: string,
) {
  const database = await getDatabase();
  const result = await database
    .update(schema.conversations)
    .set({ bnrsTransactionUuid: transactionUuid, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    );
  if (result.rowsAffected === 0) throw new Error("Conversation not found.");
}

export async function linkBnrsCertificateByApplication(
  applicationId: string,
  certificateNumber: string,
) {
  const database = await getDatabase();
  const [row] = await database
    .update(schema.conversations)
    .set({ bnrsCertificateNumber: certificateNumber, updatedAt: new Date().toISOString() })
    .where(eq(schema.conversations.bnrsApplicationId, applicationId))
    .returning({
      conversationId: schema.conversations.id,
      ownerEgovUserId: schema.conversations.ownerEgovUserId,
    });
  return row?.ownerEgovUserId
    ? {
        conversationId: row.conversationId,
        ownerEgovUserId: row.ownerEgovUserId,
      }
    : null;
}

export async function findConversationByBnrsApplication(applicationId: string) {
  const database = await getDatabase();
  const [row] = await database
    .select({
      conversationId: schema.conversations.id,
      ownerEgovUserId: schema.conversations.ownerEgovUserId,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.bnrsApplicationId, applicationId))
    .limit(1);
  return row?.ownerEgovUserId
    ? {
        conversationId: row.conversationId,
        ownerEgovUserId: row.ownerEgovUserId,
      }
    : null;
}

export async function findConversationByBnrsPayment(transactionUuid: string) {
  const database = await getDatabase();
  const [row] = await database
    .select({
      conversationId: schema.conversations.id,
      ownerEgovUserId: schema.conversations.ownerEgovUserId,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.bnrsTransactionUuid, transactionUuid))
    .limit(1);
  return row?.ownerEgovUserId
    ? { conversationId: row.conversationId, ownerEgovUserId: row.ownerEgovUserId }
    : null;
}

export async function getLguConversationLink(ownerEgovUserId: string, conversationId: string) {
  const database = await getDatabase();
  const [row] = await database
    .select({
      applicationId: schema.conversations.lguApplicationId,
      transactionUuid: schema.conversations.lguTransactionUuid,
    })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function linkLguApplication(
  ownerEgovUserId: string,
  conversationId: string,
  applicationId: string,
) {
  const database = await getDatabase();
  const result = await database
    .update(schema.conversations)
    .set({ lguApplicationId: applicationId, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    );
  if (result.rowsAffected === 0) throw new Error("Conversation not found.");
}

export async function linkLguPayment(
  ownerEgovUserId: string,
  conversationId: string,
  transactionUuid: string,
) {
  const database = await getDatabase();
  const result = await database
    .update(schema.conversations)
    .set({ lguTransactionUuid: transactionUuid, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.ownerEgovUserId, ownerEgovUserId),
      ),
    );
  if (result.rowsAffected === 0) throw new Error("Conversation not found.");
}

export async function findConversationByLguApplication(applicationId: string) {
  const database = await getDatabase();
  const [row] = await database
    .select({
      conversationId: schema.conversations.id,
      ownerEgovUserId: schema.conversations.ownerEgovUserId,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.lguApplicationId, applicationId))
    .limit(1);
  return row?.ownerEgovUserId
    ? { conversationId: row.conversationId, ownerEgovUserId: row.ownerEgovUserId }
    : null;
}

export async function findConversationByLguPayment(transactionUuid: string) {
  const database = await getDatabase();
  const [row] = await database
    .select({
      conversationId: schema.conversations.id,
      ownerEgovUserId: schema.conversations.ownerEgovUserId,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.lguTransactionUuid, transactionUuid))
    .limit(1);
  return row?.ownerEgovUserId
    ? { conversationId: row.conversationId, ownerEgovUserId: row.ownerEgovUserId }
    : null;
}
