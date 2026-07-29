import { readSession } from "@/lib/auth/session";
import { createBirFormArtifact } from "@/lib/bir-form/artifact";
import { generateDemoBusinessFilePdf } from "@/lib/business-file-pdf";
import { buildBir2303Input, generateBir2303Html } from "@/lib/form-generators/bir-2303";
import { getBusiness } from "@/server/businesses";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id, fileId } = await context.params;
  const business = await getBusiness(
    {
      actor: bnrsActorFromProfile(session.rawProfile),
      legacyProfileId: session.profile.id,
    },
    id,
  );
  const file = business?.files.find((item) => item.id === fileId);
  if (!business || !file)
    return Response.json({ error: "Business file not found." }, { status: 404 });
  if (file.url) return Response.redirect(new URL(file.url, request.url));
  if (file.id === "bir-form-1901") {
    const artifact = await createBirFormArtifact(request, session.rawProfile);
    return Response.redirect(new URL(artifact.url, request.url));
  }
  if (file.id === "bir-form-2303") {
    return new Response(generateBir2303Html(buildBir2303Input(business)), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${file.filename.replace(/[^a-z0-9._-]/gi, "-")}"`,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
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
