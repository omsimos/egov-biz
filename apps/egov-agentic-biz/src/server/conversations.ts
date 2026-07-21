import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";
import type { BusinessConversation, ConversationSummary } from "@/lib/business-chat";
import { getDatabase } from "@/server/db";

type ConversationRow = {
  id: string;
  title: string;
  initial_prompt: string;
  active_stream_id: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = { id: string; role: UIMessage["role"]; parts_json: string };

function titleFor(prompt: string) {
  const title = prompt.replace(/\s+/g, " ").trim();
  return title.slice(0, 68) || "New registration plan";
}

export function deleteConversation(id: string) {
  return getDatabase().prepare("DELETE FROM conversations WHERE id = ?").run(id).changes > 0;
}

function mapSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    initialPrompt: row.initial_prompt,
    activeStreamId: row.active_stream_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listConversations(): ConversationSummary[] {
  const rows = getDatabase().prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all() as ConversationRow[];
  return rows.map(mapSummary);
}

export function getConversation(id: string): BusinessConversation | null {
  const database = getDatabase();
  const row = database.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConversationRow | undefined;
  if (!row) return null;
  const payment = database.prepare("SELECT status FROM payments WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(id) as { status: string } | undefined;
  const messages = database
    .prepare("SELECT id, role, parts_json FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(id) as MessageRow[];
  return {
    ...mapSummary(row),
    paymentStatus: payment?.status ?? null,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: JSON.parse(message.parts_json) as UIMessage["parts"],
    })),
  } as BusinessConversation;
}

export function createConversation(initialPrompt: string, id = randomUUID()): BusinessConversation {
  const prompt = initialPrompt.trim();
  const now = new Date().toISOString();
  getDatabase().prepare(`
    INSERT INTO conversations (id, title, initial_prompt, active_stream_id, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?)
  `).run(id, titleFor(prompt), prompt, now, now);
  return getConversation(id)!;
}

export function setActiveStream(id: string, streamId: string | null) {
  getDatabase().prepare("UPDATE conversations SET active_stream_id = ?, updated_at = ? WHERE id = ?")
    .run(streamId, new Date().toISOString(), id);
}

export function saveMessages(conversationId: string, messages: UIMessage[]) {
  const database = getDatabase();
  database.transaction(() => {
    const existing = new Set(
      (database.prepare("SELECT id FROM messages WHERE conversation_id = ?").all(conversationId) as { id: string }[])
        .map(({ id }) => id),
    );
    const upsert = database.prepare(`
      INSERT INTO messages (id, conversation_id, role, parts_json, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, parts_json = excluded.parts_json
    `);
    messages.forEach((message, index) => {
      upsert.run(message.id, conversationId, message.role, JSON.stringify(message.parts), new Date(Date.now() + index).toISOString());
      existing.delete(message.id);
    });
    const remove = database.prepare("DELETE FROM messages WHERE id = ? AND conversation_id = ?");
    for (const id of existing) remove.run(id, conversationId);
    database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), conversationId);
  })();
}

export function markPaymentCheckpointComplete(conversationId: string) {
  const conversation = getConversation(conversationId);
  if (!conversation) return;
  let changed = false;
  for (const message of [...conversation.messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (part.type !== "tool-updatePlan" || part.state !== "output-available") continue;
      const output = part.output as { plan?: { title: string; steps: { id: string; label: string; status: string }[] } };
      if (!output.plan) continue;
      let nextActivated = false;
      output.plan.steps = output.plan.steps.map((step) => {
        if (step.id === "name-registration" || step.id === "payment") return { ...step, status: "completed" };
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
  if (changed) saveMessages(conversationId, conversation.messages);
}
