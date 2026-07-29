import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import { storeSessionArtifact } from "@/lib/auth/session";
import { bir1901TemplatePath, generateBir1901Pdf } from "@/lib/bir-form/generator";
import { mapEgovProfileToBir1901 } from "@/lib/bir-form/profile";
import type { Bir1901Data, GenerateBirFormInput } from "@/lib/bir-form/schema";

export type BirFormArtifact = {
  artifactId: string;
  filename: "BIR-Form-1901.pdf";
  mediaType: "application/pdf";
  pageCount: number;
  size: number;
  url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDefined<T>(base: T, override: T): T {
  if (!isRecord(base) || !isRecord(override)) return override === undefined ? base : override;

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = merged[key];
    merged[key] = isRecord(current) && isRecord(value) ? mergeDefined(current, value) : value;
  }
  return merged as T;
}

export function mergeBir1901Data(profileData: Bir1901Data, inputData: Bir1901Data) {
  return mergeDefined<Bir1901Data>(profileData, inputData);
}

export async function createBirFormArtifact(
  request: Request,
  profile: EgovSsoCitizenProfile,
  input: GenerateBirFormInput = { type: "1901", data: {} },
): Promise<BirFormArtifact> {
  let generated: Awaited<ReturnType<typeof generateBir1901Pdf>>;
  let filename: "BIR-Form-1901.pdf";
  switch (input.type) {
    case "1901": {
      const profileData = mapEgovProfileToBir1901(profile);
      const data = mergeBir1901Data(profileData, input.data);
      generated = await generateBir1901Pdf(data, bir1901TemplatePath());
      filename = "BIR-Form-1901.pdf";
      break;
    }
  }
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
