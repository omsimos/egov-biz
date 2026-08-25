import type { EgovSsoCitizenProfile } from "egov.js";

import { payloadString } from "../boundary.js";

import type {
  BnrsBusinessAddressInput,
  BnrsOwnerInformationInput,
  BnrsResidentialAddressPrefill,
} from "./types.js";

// Every caller passes a field of `EgovSsoCitizenProfile`, which the eGov SDK
// types as `string | null | undefined`. The payload still arrives as JSON, so it
// goes through the boundary parser before it is trimmed.
function normalizedString(value: string | null | undefined): string | undefined {
  const text = payloadString(value);
  if (text === undefined) return undefined;
  const normalized = text.trim().replace(/\s+/g, " ");
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

  const owner: BnrsOwnerInformationInput = {};
  if (citizenship !== undefined) owner.citizenship = citizenship;
  if (firstName !== undefined) owner.firstName = firstName;
  if (middleName !== undefined) owner.middleName = middleName;
  if (lastName !== undefined) owner.lastName = lastName;
  if (suffix !== undefined) owner.suffix = suffix;
  if (birthDate !== undefined) owner.birthDate = birthDate;
  if (gender !== undefined) owner.gender = gender;
  return owner;
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

  const prefill: BnrsResidentialAddressPrefill = { source: "EGOV_RESIDENTIAL" };
  if (addressLine1 !== undefined) prefill.addressLine1 = addressLine1;
  if (addressLine2 !== undefined) prefill.addressLine2 = addressLine2;
  if (barangay !== undefined) prefill.barangay = barangay;
  if (cityMunicipality !== undefined) prefill.cityMunicipality = cityMunicipality;
  if (province !== undefined) prefill.province = province;
  if (region !== undefined) prefill.region = region;
  if (postalCode !== undefined) prefill.postalCode = postalCode;
  return prefill;
}

export function mapEgovSsoProfileToBnrsResidentialAddress(
  profile: EgovSsoCitizenProfile,
): BnrsBusinessAddressInput | null {
  const prefill = mapEgovSsoProfileToBnrsResidentialAddressPrefill(profile);
  const { addressLine1, barangay, cityMunicipality, province, region, postalCode } = prefill;

  if (!addressLine1 || !barangay || !cityMunicipality || !province || !region || !postalCode)
    return null;

  const address: BnrsBusinessAddressInput = {
    source: "EGOV_RESIDENTIAL",
    addressLine1,
    barangay,
    cityMunicipality,
    province,
    region,
    postalCode,
  };
  if (prefill.addressLine2 !== undefined) address.addressLine2 = prefill.addressLine2;
  return address;
}
