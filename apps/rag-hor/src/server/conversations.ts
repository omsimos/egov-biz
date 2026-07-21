import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";
import type { Conversation, ConversationSummary } from "@/lib/types";
import { getDatabase } from "@/server/db";

interface ConversationRow {
  id: string;
  hearing_id: string;
  title: string;
  active_stream_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  role: UIMessage["role"];
  parts_json: string;
}

function mapSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    hearingId: row.hearing_id,
    title: row.title,
    activeStreamId: row.active_stream_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listConversations(hearingId: string): ConversationSummary[] {
  return (
    getDatabase()
      .prepare("SELECT * FROM conversations WHERE hearing_id = ? ORDER BY updated_at DESC")
      .all(hearingId) as ConversationRow[]
  ).map(mapSummary);
}

export function getConversation(id: string): Conversation | null {
  const database = getDatabase();
  const row = database.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | ConversationRow
    | undefined;
  if (!row) return null;
  const messages = database
    .prepare("SELECT id, role, parts_json FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(id) as MessageRow[];
  return {
    ...mapSummary(row),
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: JSON.parse(message.parts_json) as UIMessage["parts"],
    })),
  };
}

export function createConversation(hearingId: string, id: string = randomUUID()): Conversation {
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      "INSERT INTO conversations (id, hearing_id, title, active_stream_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)",
    )
    .run(id, hearingId, "New inquiry", now, now);
  return getConversation(id)!;
}

export function ensureConversation(id: string, hearingId: string) {
  return getConversation(id) ?? createConversation(hearingId, id);
}

export function setActiveStream(id: string, streamId: string | null) {
  getDatabase()
    .prepare("UPDATE conversations SET active_stream_id = ?, updated_at = ? WHERE id = ?")
    .run(streamId, new Date().toISOString(), id);
}

function messageText(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

export function saveMessages(conversationId: string, messages: UIMessage[]) {
  const database = getDatabase();
  const save = database.transaction(() => {
    const existing = new Set(
      (database.prepare("SELECT id FROM messages WHERE conversation_id = ?").all(conversationId) as { id: string }[]).map(
        (row) => row.id,
      ),
    );
    const upsert = database.prepare(`
      INSERT INTO messages (id, conversation_id, role, parts_json, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, parts_json = excluded.parts_json
    `);
    for (const message of messages) {
      upsert.run(message.id, conversationId, message.role, JSON.stringify(message.parts), new Date().toISOString());
      existing.delete(message.id);
    }
    const remove = database.prepare("DELETE FROM messages WHERE id = ? AND conversation_id = ?");
    for (const id of existing) remove.run(id, conversationId);

    const firstUserMessage = messages.find((message) => message.role === "user");
    const title = firstUserMessage ? messageText(firstUserMessage).slice(0, 68) || "New inquiry" : "New inquiry";
    database
      .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
      .run(title, new Date().toISOString(), conversationId);
  });
  save();
}
