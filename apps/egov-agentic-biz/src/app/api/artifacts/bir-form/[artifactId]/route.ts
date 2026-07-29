import { birFormArtifactOwnerId, readSession } from "@/lib/auth/session";
import { downloadBirForm } from "@/server/r2";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) return new Response(null, { status: 404 });

  const session = readSession(request);
  if (!session) return new Response(null, { status: 404 });

  const artifact = await downloadBirForm(birFormArtifactOwnerId(session), artifactId, {
    signal: request.signal,
  });
  if (!artifact) return new Response(null, { status: 404 });

  const body = Uint8Array.from(artifact.bytes).buffer;
  return new Response(body, {
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
