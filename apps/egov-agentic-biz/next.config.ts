import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Keep the phone mock clean during demos — no floating dev-tools badge.
  devIndicators: false,
};

export default nextConfig;
