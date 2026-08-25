import type { EgovSsoCitizenProfile } from "egov.js";

import { payloadString } from "../boundary.js";

import { normalizeLguTin } from "./service.js";
import type { LguApplicantInformationInput } from "./types.js";

// Every caller passes a name field of `EgovSsoCitizenProfile`, which the eGov SDK
// types as `string | null | undefined`. The payload still arrives as JSON, so it
// goes through the boundary parser before it is normalized.
function normalizedString(value: string | null | undefined): string | undefined {
  const text = payloadString(value);
  if (text === undefined) return undefined;
  const normalized = text.normalize("NFKC").trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

export function mapEgovSsoProfileToLguApplicantInformation(
  profile: EgovSsoCitizenProfile,
): LguApplicantInformationInput {
  const ownerName = [profile.first_name, profile.middle_name, profile.last_name, profile.suffix]
    .map(normalizedString)
    .filter((value): value is string => value !== undefined)
    .join(" ");
  const tin = normalizeLguTin(profile.tin_id);
  const applicant: LguApplicantInformationInput = { ownerName };
  if (tin !== undefined) applicant.tin = tin;
  return applicant;
}
