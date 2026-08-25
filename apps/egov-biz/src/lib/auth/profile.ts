import type { CitizenProfile } from "@/lib/citizen-profile";
import {
  payloadRecord,
  payloadText,
  type EgovProfilePayload,
  type PayloadValue,
} from "@/lib/payload";
import { maskTin, resolveSsoTin } from "@/lib/tin";

function stringValue(value: PayloadValue): string {
  return payloadText(value).trim();
}

function joinNonEmpty(parts: ReadonlyArray<PayloadValue>, separator = " ") {
  return parts
    .map(stringValue)
    .filter((part) => part.length > 0)
    .join(separator);
}

export function mapEgovCitizenProfile(profile: EgovProfilePayload): CitizenProfile {
  const rawProfile = payloadRecord(profile);
  const fullName = joinNonEmpty([
    rawProfile.first_name,
    rawProfile.middle_name,
    rawProfile.last_name,
    rawProfile.suffix,
  ]);
  const address =
    stringValue(rawProfile.address) ||
    joinNonEmpty(
      [
        rawProfile.street,
        rawProfile.barangay,
        rawProfile.municipality,
        rawProfile.province,
        rawProfile.postal,
      ],
      ", ",
    );

  return {
    id: stringValue(rawProfile.uniqid),
    firstName: stringValue(rawProfile.first_name),
    fullName,
    email: stringValue(rawProfile.email),
    mobile: stringValue(rawProfile.mobile),
    address,
    city: stringValue(rawProfile.municipality),
    barangay: stringValue(rawProfile.barangay),
    province: stringValue(rawProfile.province),
    birthDate: stringValue(rawProfile.birth_date),
    gender: stringValue(rawProfile.gender),
    nationality: stringValue(rawProfile.nationality),
    tinMasked: maskTin(resolveSsoTin(rawProfile)),
    rdo: "",
    avatarUrl: stringValue(rawProfile.photo) ? "/api/auth/avatar" : null,
  };
}
