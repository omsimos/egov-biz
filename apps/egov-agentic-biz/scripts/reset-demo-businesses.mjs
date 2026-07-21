import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";

const databasePath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "egov-agentic-biz.sqlite");
const database = new Database(databasePath);
try {
  const table = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'registered_businesses'",
    )
    .get();
  const removed = table ? database.prepare("DELETE FROM registered_businesses").run().changes : 0;
  console.log(
    `Reset complete: removed ${removed} linked demo business record${removed === 1 ? "" : "s"}.`,
  );
  console.log(`Database: ${databasePath}`);
  console.log("Authentication sessions, conversations, messages, and payments were preserved.");
} finally {
  database.close();
}
