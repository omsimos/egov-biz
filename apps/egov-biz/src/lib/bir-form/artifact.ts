import type { EgovSsoCitizenProfile } from "egov.js";
import type {
  Bir1901Data,
  Bir1905Data,
  BirFormArtifact as DxBirFormArtifact,
  GenerateBirFormInput,
} from "@omsimos/dx/bir";
import { mapEgovProfileToBir1901, mapEgovProfileToBir1905 } from "@/lib/bir-form/profile";
import { isPayloadRecord, type MutablePayloadRecord } from "@/lib/payload";
import type { BusinessPlan } from "@/lib/questions";
import { linkBirArtifact } from "@/server/dx/bir-artifacts";
import { getBir } from "@/server/dx/bir";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";

export type BirFormArtifact = DxBirFormArtifact & {
  url: string;
};

function mergeDefined<T>(base: T, override: T): T {
  if (!isPayloadRecord(base) || !isPayloadRecord(override))
    return override === undefined ? base : override;

  const merged: MutablePayloadRecord = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = merged[key];
    merged[key] =
      isPayloadRecord(current) && isPayloadRecord(value) ? mergeDefined(current, value) : value;
  }
  // SAFETY: `merged` starts as a copy of `base`, and every key it takes from
  // `override` is a key `override` already carries — both are Ts — so it holds
  // the fields of a T. TypeScript cannot follow that through the index
  // signature the merge needs to walk the two objects.
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
