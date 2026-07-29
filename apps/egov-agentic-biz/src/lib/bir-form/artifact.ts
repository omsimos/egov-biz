import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import { birFormArtifactOwnerId, readSession } from "@/lib/auth/session";
import { bir1905TemplatePath, generateBir1905Pdf } from "@/lib/bir-form/generator-1905";
import { bir1901TemplatePath, generateBir1901Pdf } from "@/lib/bir-form/generator";
import { mapEgovProfileToBir1901, mapEgovProfileToBir1905 } from "@/lib/bir-form/profile";
import type { Bir1901Data, Bir1905Data, GenerateBirFormInput } from "@/lib/bir-form/schema";
import { uploadBirForm } from "@/server/r2";

export type BirFormArtifact = {
  artifactId: string;
  filename: "BIR-Form-1901.pdf" | "BIR-Form-1905.pdf";
  formType: "1901" | "1905";
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

export function mergeBir1905Data(profileData: Bir1905Data, inputData: Bir1905Data) {
  return mergeDefined<Bir1905Data>(profileData, inputData);
}

export async function createBirFormArtifact(
  request: Request,
  profile: EgovSsoCitizenProfile,
  input: GenerateBirFormInput = { type: "1901", data: {} },
): Promise<BirFormArtifact> {
  let generated: { bytes: Uint8Array; pageCount: number; size: number };
  let filename: BirFormArtifact["filename"];
  switch (input.type) {
    case "1901": {
      const profileData = mapEgovProfileToBir1901(profile);
      const data = mergeBir1901Data(profileData, input.data);
      generated = await generateBir1901Pdf(data, bir1901TemplatePath());
      filename = "BIR-Form-1901.pdf";
      break;
    }
    case "1905": {
      const profileData = mapEgovProfileToBir1905(profile);
      const data = mergeBir1905Data(profileData, input.data);
      generated = await generateBir1905Pdf(data, bir1905TemplatePath());
      filename = "BIR-Form-1905.pdf";
      break;
    }
  }
  const mediaType = "application/pdf" as const;
  const session = readSession(request);
  if (!session) throw new Error("The authenticated session is no longer available");
  const ownerId = birFormArtifactOwnerId(session);

  const artifactId = crypto.randomUUID();
  await uploadBirForm(ownerId, artifactId, input.type, generated.bytes, {
    signal: request.signal,
  });

  return {
    artifactId,
    filename,
    formType: input.type,
    mediaType,
    pageCount: generated.pageCount,
    size: generated.size,
    url: `/api/artifacts/bir-form/${artifactId}`,
  };
}
