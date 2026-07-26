"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";

const SOURCES = {
  "egov-sso": "/images/logo-egov-sso.png",
  egovai: "/images/logo-egovai.png",
  egovpay: "/images/logo-egovpay.png",
} as const;

// The official service marks live in the design project but cannot be pulled
// through the design MCP (read_file entity-escapes binary bodies), so they are
// not in the repo yet. Rendering falls back to the Phosphor icon the call site
// already used; drop the PNG into public/images/ and it upgrades with no code
// change. onError covers the missing-file case at runtime.
export function ServiceLogo({
  className,
  fallback,
  height = 20,
  service,
}: {
  className?: string;
  fallback: ReactNode;
  height?: number;
  service: keyof typeof SOURCES;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <Image
      alt=""
      className={className}
      height={height}
      onError={() => setFailed(true)}
      src={SOURCES[service]}
      style={{ height, width: "auto" }}
      unoptimized
      width={height * 4}
    />
  );
}
