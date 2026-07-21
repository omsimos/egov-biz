import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "@/lib/env";

declare global {
  var __egovBizDatabase: Database.Database | undefined;
}

function initialize(database: Database.Database) {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      initial_prompt TEXT NOT NULL,
      active_stream_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_updated
      ON conversations(updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      parts_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
      ON messages(conversation_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      transaction_uuid TEXT NOT NULL UNIQUE,
      transaction_id TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      proposed_name TEXT NOT NULL,
      territorial_scope TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      paid_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_payments_conversation_created
      ON payments(conversation_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS registered_businesses (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL UNIQUE,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      status TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      business_activity TEXT NOT NULL,
      business_address TEXT NOT NULL,
      city TEXT NOT NULL,
      rdo TEXT NOT NULL,
      tin_masked TEXT NOT NULL,
      records_json TEXT NOT NULL,
      tax_obligations_json TEXT NOT NULL,
      files_json TEXT NOT NULL DEFAULT '[]',
      finalized_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_registered_businesses_profile_updated
      ON registered_businesses(profile_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      raw_profile_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
      ON auth_sessions(expires_at);
  `);
  const paymentColumns = database.prepare("PRAGMA table_info(payments)").all() as {
    name: string;
  }[];
  if (!paymentColumns.some(({ name }) => name === "service_type")) {
    database.exec(
      "ALTER TABLE payments ADD COLUMN service_type TEXT NOT NULL DEFAULT 'dti-business-name'",
    );
  }
  const businessColumns = database.prepare("PRAGMA table_info(registered_businesses)").all() as {
    name: string;
  }[];
  if (!businessColumns.some(({ name }) => name === "files_json")) {
    database.exec(
      "ALTER TABLE registered_businesses ADD COLUMN files_json TEXT NOT NULL DEFAULT '[]'",
    );
  }
  if (!paymentColumns.some(({ name }) => name === "service_reference")) {
    database.exec("ALTER TABLE payments ADD COLUMN service_reference TEXT");
  }
  database.exec(`CREATE INDEX IF NOT EXISTS idx_payments_conversation_service
    ON payments(conversation_id, service_type, created_at DESC)`);
}

export function getDatabase() {
  if (globalThis.__egovBizDatabase) return globalThis.__egovBizDatabase;
  fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
  const database = new Database(env.databasePath);
  initialize(database);
  globalThis.__egovBizDatabase = database;
  return database;
}
