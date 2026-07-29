import type { EgovSsoCitizenProfile } from "egov.js";

import type {
  BnrsBusinessAddressInput,
  BnrsOwnerInformationInput,
  BnrsResidentialAddressPrefill,
} from "./types.js";

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

export function mapEgovSsoProfileToBnrsResidentialAddressPrefill(
  profile: EgovSsoCitizenProfile,
): BnrsResidentialAddressPrefill {
  // `address` is commonly the full formatted address, while `street` is the
  // BNRS address-line-1 value. Prefer the structured field when both exist.
  const addressLine1 = normalizedString(profile.street) ?? normalizedString(profile.address);
  const addressLine2 = normalizedString(profile.address_line_2);
  const barangay = normalizedString(profile.barangay);
  const cityMunicipality = normalizedString(profile.municipality);
  const province = normalizedString(profile.province);
  const region = normalizedString(profile.region);
  const rawPostalCode = normalizedString(profile.postal);
  const postalCode = rawPostalCode && /^\d{4}$/.test(rawPostalCode) ? rawPostalCode : undefined;

  return {
    source: "EGOV_RESIDENTIAL",
    ...(addressLine1 === undefined ? {} : { addressLine1 }),
    ...(addressLine2 === undefined ? {} : { addressLine2 }),
    ...(barangay === undefined ? {} : { barangay }),
    ...(cityMunicipality === undefined ? {} : { cityMunicipality }),
    ...(province === undefined ? {} : { province }),
    ...(region === undefined ? {} : { region }),
    ...(postalCode === undefined ? {} : { postalCode }),
  };
}

export function mapEgovSsoProfileToBnrsResidentialAddress(
  profile: EgovSsoCitizenProfile,
): BnrsBusinessAddressInput | null {
  const prefill = mapEgovSsoProfileToBnrsResidentialAddressPrefill(profile);
  const { addressLine1, barangay, cityMunicipality, province, region, postalCode } = prefill;

  if (!addressLine1 || !barangay || !cityMunicipality || !province || !region || !postalCode)
    return null;

  return {
    source: "EGOV_RESIDENTIAL",
    addressLine1,
    ...(prefill.addressLine2 === undefined ? {} : { addressLine2: prefill.addressLine2 }),
    barangay,
    cityMunicipality,
    province,
    region,
    postalCode,
  };
}
