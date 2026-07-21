import { readSessionArtifact } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) return new Response(null, { status: 404 });

  const artifact = readSessionArtifact(request, artifactId);
  if (!artifact) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(artifact.bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${artifact.filename}"`,
      "Content-Length": String(artifact.bytes.byteLength),
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Content-Type": artifact.mediaType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
