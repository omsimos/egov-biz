import type { CitizenProfile } from "@/lib/citizen-profile";
import type { UserInfoOutput } from "@/lib/business-chat";
import type { BusinessPlan } from "@/lib/questions";
import type { BnrsBusinessAddressInput, BnrsResidentialAddressPrefill } from "@omsimos/dx/bnrs";

export const structuredBusinessAddressQuestionFields = {
  "business-address-line-1": "addressLine1",
  "business-barangay": "barangay",
  "business-city-municipality": "cityMunicipality",
  "business-province": "province",
  "business-region": "region",
  "business-postal-code": "postalCode",
} as const;

export type StructuredBusinessAddressQuestionId =
  keyof typeof structuredBusinessAddressQuestionFields;

export type StructuredBusinessAddressAnswers = Partial<
  Record<StructuredBusinessAddressQuestionId, string>
>;

export function resolveBusinessFormAddress(
  providedAddress: string,
  profile: CitizenProfile | null,
  usesProfileAddress: boolean,
) {
  const provided = providedAddress.trim();
  if (provided) return provided;
  return usesProfileAddress ? (profile?.address.trim() ?? "") : "";
}

export function profileAddressPreference(value: string | string[] | undefined) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  if (selected.includes("use-profile-address")) return "profile" as const;
  if (selected.includes("use-different-address")) return "different" as const;
  return null;
}

export function shouldCollectStructuredBusinessAddress(
  preference: ReturnType<typeof profileAddressPreference>,
  registrationType: BusinessPlan["registrationType"],
  hasCompleteResidentialAddress: boolean,
) {
  if (!preference) return false;
  if (preference === "different") return true;
  return registrationType !== "Self-employed" && !hasCompleteResidentialAddress;
}

function normalizedAddressValue(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function resolvedStructuredAddressValues(
  preference: ReturnType<typeof profileAddressPreference>,
  profilePrefill: BnrsResidentialAddressPrefill | null,
  answers: StructuredBusinessAddressAnswers,
) {
  return Object.fromEntries(
    Object.entries(structuredBusinessAddressQuestionFields).map(([questionId, field]) => {
      const answer = normalizedAddressValue(
        answers[questionId as StructuredBusinessAddressQuestionId],
      );
      const profileValue =
        preference === "profile" ? normalizedAddressValue(profilePrefill?.[field]) : "";
      return [field, answer || profileValue];
    }),
  ) as Record<
    (typeof structuredBusinessAddressQuestionFields)[StructuredBusinessAddressQuestionId],
    string
  >;
}

export function missingStructuredBusinessAddressQuestionIds(
  preference: ReturnType<typeof profileAddressPreference>,
  profilePrefill: BnrsResidentialAddressPrefill | null,
  answers: StructuredBusinessAddressAnswers,
): StructuredBusinessAddressQuestionId[] {
  if (!preference) return [];
  const values = resolvedStructuredAddressValues(preference, profilePrefill, answers);
  return (
    Object.entries(structuredBusinessAddressQuestionFields) as Array<
      [StructuredBusinessAddressQuestionId, keyof typeof values]
    >
  )
    .filter(([questionId, field]) => {
      const value = values[field];
      return questionId === "business-postal-code" ? !/^\d{4}$/.test(value) : !value;
    })
    .map(([questionId]) => questionId);
}

export function resolveStructuredBusinessAddress(
  preference: ReturnType<typeof profileAddressPreference>,
  profilePrefill: BnrsResidentialAddressPrefill | null,
  answers: StructuredBusinessAddressAnswers,
): BnrsBusinessAddressInput | null {
  if (!preference) return null;
  const values = resolvedStructuredAddressValues(preference, profilePrefill, answers);
  if (
    !values.addressLine1 ||
    !values.barangay ||
    !values.cityMunicipality ||
    !values.province ||
    !values.region ||
    !/^\d{4}$/.test(values.postalCode)
  )
    return null;

  const hasManualAddressValue = Object.values(answers).some(
    (value) => normalizedAddressValue(value).length > 0,
  );
  return {
    source:
      preference === "profile" && !hasManualAddressValue ? "EGOV_RESIDENTIAL" : "USER_PROVIDED",
    addressLine1: values.addressLine1,
    ...(preference === "profile" && profilePrefill?.addressLine2
      ? { addressLine2: profilePrefill.addressLine2 }
      : {}),
    barangay: values.barangay,
    cityMunicipality: values.cityMunicipality,
    province: values.province,
    region: values.region,
    postalCode: values.postalCode,
  };
}

export function extractExplicitBusinessAddress(prompt: string) {
  const matches = [
    ...prompt.matchAll(
      /\b(?:business )?address(?:\s+(?:is|to)|\s*[:=])\s*[“"]?([^”"\n]{5,180}?)(?=(?:[.!?]\s+(?:change|update|correct|set|use|my|the)\b)|$)/gi,
    ),
  ];
  return matches.at(-1)?.[1]?.trim().replace(/[.]+$/, "") ?? "";
}

export function availableUserInfoFields(profile: CitizenProfile) {
  const candidates: Array<[UserInfoOutput["availableFields"][number], string]> = [
    ["fullName", profile.fullName],
    ["birthDate", profile.birthDate],
    ["gender", profile.gender],
    ["nationality", profile.nationality],
    ["email", profile.email],
    ["mobile", profile.mobile],
    ["address", profile.address],
    ["barangay", profile.barangay],
    ["municipality", profile.city],
    ["province", profile.province],
  ];
  return candidates.filter(([, value]) => value.trim().length > 0).map(([field]) => field);
}
