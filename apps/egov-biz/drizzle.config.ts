import { defineConfig } from "drizzle-kit";

// `turso` covers both remote Turso databases and local `file:` URLs, so the
// same commands work against either. drizzle-kit reads .env itself.
export default defineConfig({
  dbCredentials: {
    authToken: process.env.TURSO_AUTH_TOKEN,
    url: process.env.TURSO_DATABASE_URL ?? "",
  },
  dialect: "turso",
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
  strict: true,
  verbose: true,
});
