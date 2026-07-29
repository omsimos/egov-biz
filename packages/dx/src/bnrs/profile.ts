import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";

import type { BnrsOwnerInformationInput } from "./types.js";

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : undefined;
}

function citizenshipFromProfile(profile: EgovSsoCitizenProfile): string | undefined {
  const value =
    normalizedString(profile.nationality) ??
    normalizedString(profile.country_alpha_3_code) ??
    normalizedString(profile.country_alpha_2_code) ??
    normalizedString(profile.country);
  if (!value) return undefined;
  return /^(?:PH|PHL|PHILIPPINES|FILIPINO)$/i.test(value) ? "Filipino" : value;
}

export function mapEgovSsoProfileToBnrsOwnerInformation(
  profile: EgovSsoCitizenProfile,
): BnrsOwnerInformationInput {
  const citizenship = citizenshipFromProfile(profile);
  const firstName = normalizedString(profile.first_name);
  const middleName = normalizedString(profile.middle_name);
  const lastName = normalizedString(profile.last_name);
  const suffix = normalizedString(profile.suffix);
  const birthDate = normalizedString(profile.birth_date ?? profile.passport?.birth_date);
  const gender = normalizedString(profile.gender);

  return {
    ...(citizenship === undefined ? {} : { citizenship }),
    ...(firstName === undefined ? {} : { firstName }),
    ...(middleName === undefined ? {} : { middleName }),
    ...(lastName === undefined ? {} : { lastName }),
    ...(suffix === undefined ? {} : { suffix }),
    ...(birthDate === undefined ? {} : { birthDate }),
    ...(gender === undefined ? {} : { gender }),
  };
}
