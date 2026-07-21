import { describe, expect, test } from "bun:test";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import { mapEgovCitizenProfile } from "@/lib/auth/profile";

const profile: EgovSsoCitizenProfile = {
  additional_information: {},
  address: "",
  address_line_2: null,
  barangay: "San Isidro",
  barangay_code: "0001",
  birth_date: "1990-01-01",
  country: "Philippines",
  country_alpha_2_code: "PH",
  country_alpha_3_code: "PHL",
  country_id: 1,
  email: "juan@example.test",
  first_name: "Juan",
  foreign_address: null,
  gender: "Male",
  last_name: "Dela Cruz",
  middle_name: "Santos",
  mobile: "+639000000000",
  municipality: "Quezon City",
  municipality_code: "137404",
  national_id: null,
  nationality: "Filipino",
  passport: null,
  photo: "data:image/png;base64,aGVsbG8=",
  postal: "1100",
  province: "Metro Manila",
  province_code: "1300",
  region: "NCR",
  region_code: "130000000",
  signature: null,
  signature_url: null,
  street: "1 Example Street",
  suffix: "Jr.",
  tin_id: null,
  uniqid: "example-user-id",
};

describe("mapEgovCitizenProfile", () => {
  test("maps only authenticated SSO fields used by the app", () => {
    const result = mapEgovCitizenProfile(profile);

    expect(result.fullName).toBe("Juan Santos Dela Cruz Jr.");
    expect(result.city).toBe("Quezon City");
    expect(result.address).toBe("1 Example Street, San Isidro, Quezon City, Metro Manila, 1100");
    expect(result.avatarUrl).toBe("/api/auth/avatar");
    expect(result.tinMasked).toBe("");
    expect(result.rdo).toBe("");
  });
});
