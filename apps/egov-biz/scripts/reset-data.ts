/**
 * Truncates every application table without touching the schema.
 *
 * The tables, indexes and the drizzle migration bookkeeping all survive, so the
 * database stays migrated and usable — only the rows go away. Use
 * `bun run db:reset` instead when the goal is to throw the local file away.
 */
import { sql } from "drizzle-orm";
import { createDatabase, schema } from "@/server/db";
import { tursoConfig } from "@/server/db/config";

// Children before parents: the cascades would handle most of these, but an
// explicit order keeps the run deterministic and the per-table counts honest.
const TABLES = [
  { name: "messages", table: schema.messages },
  { name: "conversation_artifacts", table: schema.conversationArtifacts },
  { name: "payments", table: schema.payments },
  { name: "sms_dispatches", table: schema.smsDispatches },
  { name: "registered_businesses", table: schema.registeredBusinesses },
  { name: "conversations", table: schema.conversations },
  { name: "sms_quota_buckets", table: schema.smsQuotaBuckets },
  { name: "auth_sessions", table: schema.authSessions },
] as const;

const AUTH_TABLE = "auth_sessions";

function hasFlag(...names: string[]) {
  return names.some((name) => process.argv.includes(name));
}

async function confirm(question: string) {
  process.stdout.write(question);
  for await (const line of console) return line.trim().toLowerCase() === "yes";
  return false;
}

async function main() {
  const config = tursoConfig();
  const keepAuth = hasFlag("--keep-auth");
  const targets = TABLES.filter(({ name }) => !(keepAuth && name === AUTH_TABLE));

  console.log(`Target database: ${config.url}${config.isLocal ? " (local file)" : " (remote)"}`);
  if (keepAuth) console.log(`Keeping ${AUTH_TABLE} — signed-in sessions stay valid.`);

  if (!hasFlag("--yes", "-y")) {
    // A remote URL is very likely the shared/deployed database, so make the
    // operator retype the confirmation instead of accepting a bare newline.
    const accepted = await confirm(
      `Delete all rows from ${targets.length} table(s)? Type "yes" to continue: `,
    );
    if (!accepted) {
      console.log("Aborted — nothing was deleted.");
      return;
    }
  }

  const { client, database } = createDatabase(config);
  try {
    for (const { name, table } of targets) {
      const [row] = await database.all<{ count: number }>(
        sql`select count(*) as count from ${table}`,
      );
      const before = row?.count ?? 0;
      await database.delete(table);
      console.log(`  ${name}: deleted ${before} row(s)`);
    }

    // Reclaims the space the deleted rows held. Turso's remote HTTP protocol
    // rejects VACUUM, so it only runs against a local file.
    if (config.isLocal) await database.run(sql`vacuum`);
  } finally {
    client.close();
  }

  console.log("Done — tables are intact and empty.");
}

await main();
