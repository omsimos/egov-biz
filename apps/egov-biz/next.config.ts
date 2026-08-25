import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // The app imports workspace packages outside its directory, so trace from
  // the monorepo root when collecting production dependencies.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  reactCompiler: true,
  // Keep the phone mock clean during demos — no floating dev-tools badge.
  devIndicators: false,
};

// The standalone bundle exists for the Docker image, which copies
// .next/standalone into its final stage. Vercel builds its own server output
// and its post-build step reads the default trace files that standalone does
// not emit, so it fails with ENOENT on next-server.js.nft.json. Leave the
// default output in place there.
if (!process.env.VERCEL) nextConfig.output = "standalone";

export default nextConfig;
