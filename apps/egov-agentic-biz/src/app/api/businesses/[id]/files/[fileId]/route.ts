import { readSession } from "@/lib/auth/session";
import { createBirFormArtifact } from "@/lib/bir-form/artifact";
import { generateDemoBusinessFilePdf } from "@/lib/business-file-pdf";
import { getRegisteredBusiness } from "@/server/registered-businesses";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id, fileId } = await context.params;
  const business = await getRegisteredBusiness(session.profile.id, id);
  const file = business?.files.find((item) => item.id === fileId);
  if (!business || !file)
    return Response.json({ error: "Business file not found." }, { status: 404 });
  if (file.url) return Response.redirect(new URL(file.url, request.url));
  if (file.id === "bir-form-1901") {
    const artifact = await createBirFormArtifact(request, session.rawProfile);
    return Response.redirect(new URL(artifact.url, request.url));
  }

  const bytes = await generateDemoBusinessFilePdf(business, file);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${file.filename.replace(/[^a-z0-9._-]/gi, "-")}"`,
      "Content-Type": "application/pdf",
    },
  });
}
