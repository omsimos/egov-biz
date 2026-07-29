import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewStage } from "@/components/preview-stage";

export const metadata: Metadata = { robots: { index: false } };

// Design-review sandbox: renders the home screen with a fixture profile so the
// UI can be checked without completing live email, OTP, and MPIN authentication. Dev only.
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewStage />;
}
