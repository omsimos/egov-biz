import process from "node:process";
import { createDatabase, schema } from "@/server/db";

// Uses an uncached client so the script owns the connection and can close it,
// rather than leaving the request-path singleton open.
const { client, database } = createDatabase();
try {
  const result = await database.delete(schema.registeredBusinesses);
  const removed = result.rowsAffected;
  console.log(
    `Reset complete: removed ${removed} linked demo business record${removed === 1 ? "" : "s"}.`,
  );
  console.log(`Database: ${process.env.TURSO_DATABASE_URL}`);
  console.log("Authentication sessions, conversations, messages, and payments were preserved.");
} finally {
  client.close();
}
