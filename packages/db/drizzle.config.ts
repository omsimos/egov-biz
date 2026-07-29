import { defineConfig } from "drizzle-kit";
import { ensureLocalDatabaseDirectory, getTursoConfig } from "./src/config.ts";

const config = getTursoConfig();
ensureLocalDatabaseDirectory(config);

export default defineConfig({
  dbCredentials: {
    authToken: config.authToken ?? (config.isLocal ? "local-file" : undefined),
    url: config.url,
  },
  dialect: "turso",
  migrations: {
    table: "__dx_drizzle_migrations",
  },
  out: "./drizzle",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
