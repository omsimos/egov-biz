import type { EgovSsoCitizenProfile } from "egov.js";
import type {
  Bir1901Data,
  Bir1905Data,
  BirFormArtifact as DxBirFormArtifact,
  GenerateBirFormInput,
} from "@omsimos/dx/bir";
import { mapEgovProfileToBir1901, mapEgovProfileToBir1905 } from "@/lib/bir-form/profile";
import type { BusinessPlan } from "@/lib/questions";
import { linkBirArtifact } from "@/server/dx/bir-artifacts";
import { getBir } from "@/server/dx/bir";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";

export type BirFormArtifact = DxBirFormArtifact & {
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

export function currentBirRegistrationDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function bir1901TaxpayerTypeForBusinessType(
  businessType: BusinessPlan["registrationType"] | undefined,
) {
  if (businessType === "Sole proprietor") return "singleProprietorshipResidentCitizen" as const;
  if (businessType === "Self-employed") return "professionalGeneral" as const;
  return undefined;
}

export function mergeBir1901DataForBusinessType(
  profileData: Bir1901Data,
  inputData: Bir1901Data,
  businessType: BusinessPlan["registrationType"] | undefined,
) {
  const data = mergeBir1901Data(profileData, inputData);
  const taxpayerType = bir1901TaxpayerTypeForBusinessType(businessType);
  return taxpayerType ? mergeBir1901Data(data, { taxpayerInformation: { taxpayerType } }) : data;
}

export function mergeBir1905Data(profileData: Bir1905Data, inputData: Bir1905Data) {
  return mergeDefined<Bir1905Data>(profileData, inputData);
}

export async function createBirFormArtifact(
  request: Request,
  profile: EgovSsoCitizenProfile,
  input: GenerateBirFormInput = { type: "1901", data: {} },
  conversationId?: string,
  businessType?: BusinessPlan["registrationType"],
): Promise<BirFormArtifact> {
  const actor = bnrsActorFromProfile(profile);
  const form: GenerateBirFormInput =
    input.type === "1905"
      ? { type: "1905", data: mergeBir1905Data(mapEgovProfileToBir1905(profile), input.data) }
      : {
          type: "1901",
          data: mergeBir1901Data(
            mergeBir1901DataForBusinessType(
              mapEgovProfileToBir1901(profile),
              input.data,
              businessType,
            ),
            { registration: { birRegistrationDate: currentBirRegistrationDate() } },
          ),
        };
  const artifact = await getBir().fillOutAndSaveForm({
    actor,
    form,
    signal: request.signal,
  });
  if (conversationId)
    await linkBirArtifact({
      artifact,
      conversationId,
      ownerEgovUserId: actor.egovUserId,
    });
  return {
    ...artifact,
    url: `/api/artifacts/bir-form/${artifact.artifactId}`,
  };
}
