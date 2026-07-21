import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import type { CitizenProfile } from "@/lib/citizen-profile";

function joinNonEmpty(parts: ReadonlyArray<string | null | undefined>, separator = " ") {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(separator);
}

export function mapEgovCitizenProfile(profile: EgovSsoCitizenProfile): CitizenProfile {
  const fullName = joinNonEmpty([
    profile.first_name,
    profile.middle_name,
    profile.last_name,
    profile.suffix,
  ]);
  const address =
    profile.address.trim() ||
    joinNonEmpty(
      [profile.street, profile.barangay, profile.municipality, profile.province, profile.postal],
      ", ",
    );

  return {
    id: profile.uniqid,
    firstName: profile.first_name.trim(),
    fullName,
    email: profile.email.trim(),
    mobile: profile.mobile.trim(),
    address,
    city: profile.municipality.trim(),
    barangay: profile.barangay.trim(),
    province: profile.province.trim(),
    birthDate: profile.birth_date.trim(),
    gender: profile.gender.trim(),
    nationality: profile.nationality.trim(),
    tinMasked: "",
    rdo: "",
    avatarUrl: profile.photo.trim().length > 0 ? "/api/auth/avatar" : null,
  };
}
