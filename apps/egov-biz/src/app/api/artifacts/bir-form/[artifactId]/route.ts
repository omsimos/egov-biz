import { BirError } from "@omsimos/dx/bir";
import { readSession } from "@/lib/auth/session";
import { getBir } from "@/server/dx/bir";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) return new Response(null, { status: 404 });

  const session = await readSession(request);
  if (!session) return new Response(null, { status: 404 });

  let artifact;
  try {
    artifact = await getBir().getSavedForm({
      actor: bnrsActorFromProfile(session.rawProfile),
      artifactId,
      signal: request.signal,
    });
  } catch (error) {
    if (error instanceof BirError && error.code === "FORM_NOT_FOUND")
      return new Response(null, { status: 404 });
    throw error;
  }

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
