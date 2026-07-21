import { describe, expect, test } from "bun:test";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";
import { completeEgovSsoTestProfile, mapEgovProfileToBir1901 } from "@/lib/bir-form/profile";

describe("mapEgovProfileToBir1901", () => {
  test("maps every authoritative BIR 1901 field in the complete SSO fixture", () => {
    const result = mapEgovProfileToBir1901(completeEgovSsoTestProfile);

    expect(result).toMatchObject({
      addressLine2: "Unit 4B",
      barangay: "Barangay San Isidro",
      birthDate: "1990-01-23",
      birthPlace: "Manila, Metro Manila, Philippines",
      city: "Quezon City",
      civilStatus: "Married",
      email: "juan.complete@example.test",
      fatherName: "Roberto Dela Cruz",
      firstName: "Juan",
      foreignAddress: "100 Example Avenue, Sample City, 00000, Example Country",
      fullName: "Juan Santos Dela Cruz Jr.",
      gender: "Male",
      lastName: "Dela Cruz",
      middleName: "Santos",
      mobile: "+639170000000",
      motherMaidenName: "Elena Garcia Reyes",
      nationalIdPcn: "0000-0000-0000-0001",
      nationality: "Filipino",
      passportExpiryDate: "2033-06-14",
      passportIssuedDate: "2023-06-15",
      passportNumber: "P0000001",
      passportPlaceIssued: "Paranaque City, PH",
      postal: "1100",
      province: "Metro Manila",
      street: "123 Mabini Street",
      suffix: "Jr.",
      tin: "12345678900000",
    });
    expect(result.signatureSource).toStartWith("data:image/png;base64,");
  });

  test("does not guess a TIN from an unrecognized opaque value", () => {
    const profile: EgovSsoCitizenProfile = {
      ...completeEgovSsoTestProfile,
      tin_id: { opaque_identifier: "123-456-789-00000" },
    };

    expect(mapEgovProfileToBir1901(profile).tin).toBe("");
  });

  test("normalizes an entirely absent profile without throwing", () => {
    expect(mapEgovProfileToBir1901(undefined)).toEqual({
      address: "",
      addressLine2: "",
      barangay: "",
      birthDate: "",
      birthPlace: "",
      city: "",
      civilStatus: "",
      email: "",
      fatherName: "",
      firstName: "",
      foreignAddress: "",
      fullName: "",
      gender: "",
      lastName: "",
      middleName: "",
      mobile: "",
      motherMaidenName: "",
      nationalIdPcn: "",
      nationality: "",
      passportExpiryDate: "",
      passportIssuedDate: "",
      passportNumber: "",
      passportPlaceIssued: "",
      postal: "",
      province: "",
      signatureSource: "",
      street: "",
      suffix: "",
      tin: "",
    });
  });

  test("keeps valid values while ignoring missing, null, and malformed fields", () => {
    const result = mapEgovProfileToBir1901({
      additional_information: {
        birth_place: null,
        father_details: { father_firstname: " Roberto ", father_lastname: null },
        mother_details: "not-an-object",
        other_personal_information: { marital_status: 123 },
      },
      address: null,
      barangay: " San Isidro ",
      email: 123,
      first_name: " Josie ",
      last_name: null,
      municipality: " Quezon City ",
      national_id: { pcn: null, signature: 123 },
      passport: { passport_number: " P1234567 ", expiry_date: null },
      signature_url: null,
      street: " 1 Example Street ",
      tin_id: { tin_number: "123-456-789" },
    });

    expect(result).toMatchObject({
      address: "1 Example Street, San Isidro, Quezon City",
      barangay: "San Isidro",
      city: "Quezon City",
      email: "",
      fatherName: "Roberto",
      firstName: "Josie",
      fullName: "Josie",
      nationalIdPcn: "",
      passportNumber: "P1234567",
      signatureSource: "",
      street: "1 Example Street",
      tin: "123456789",
    });
  });
});
