import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Content-only site: every page prerenders to static HTML, and the Mermaid
  // diagrams are already inline SVG in that HTML. Nothing here needs a server
  // at request time.
  output: "export",
  // Keep the phone mock and screen recordings clean, same as the app.
  devIndicators: false,
};

// Generated collections land under src/ so `@/.source` resolves through the
// same `@/*` path alias as the rest of the app.
const withMDX = createMDX({ outDir: "src/.source" });

export default withMDX(nextConfig);
