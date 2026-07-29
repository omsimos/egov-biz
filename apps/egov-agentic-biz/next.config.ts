import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Emit a self-contained server that can be copied into the final Docker stage.
  output: "standalone",
  // The app installs the sibling egov.js package into the monorepo-local Bun
  // store, so trace from the workspace root when collecting dependencies.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  reactCompiler: true,
  // Keep the phone mock clean during demos — no floating dev-tools badge.
  devIndicators: false,
};

export default nextConfig;
