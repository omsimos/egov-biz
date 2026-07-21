import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import { storeSessionArtifact } from "@/lib/auth/session";
import { bir1901TemplatePath, generateBir1901Pdf } from "@/lib/bir-form/generator";
import { mapEgovProfileToBir1901 } from "@/lib/bir-form/profile";

export type BirFormArtifact = {
  artifactId: string;
  filename: "BIR-Form-1901.pdf";
  mediaType: "application/pdf";
  pageCount: number;
  size: number;
  url: string;
};

export async function createBirFormArtifact(
  request: Request,
  profile: EgovSsoCitizenProfile,
): Promise<BirFormArtifact> {
  const generated = await generateBir1901Pdf(
    mapEgovProfileToBir1901(profile),
    bir1901TemplatePath(),
  );
  const filename = "BIR-Form-1901.pdf" as const;
  const mediaType = "application/pdf" as const;
  const artifactId = storeSessionArtifact(request, {
    bytes: generated.bytes,
    filename,
    mediaType,
  });
  if (!artifactId) throw new Error("The authenticated session is no longer available");

  return {
    artifactId,
    filename,
    mediaType,
    pageCount: generated.pageCount,
    size: generated.size,
    url: `/api/artifacts/bir-form/${artifactId}`,
  };
}
