import { describe, expect, test } from "bun:test";
import type { EgovSsoCitizenProfile } from "egov.js";
import { bir1901DataSchema, bir1905DataSchema } from "@repo/utils/bir-form";
import {
  completeEgovSsoTestProfile,
  mapEgovProfileToBir1901,
  mapEgovProfileToBir1905,
} from "@/lib/bir-form/profile";

describe("mapEgovProfileToBir1901", () => {
  test("maps every authoritative BIR 1901 field in the complete SSO fixture", () => {
    const result = mapEgovProfileToBir1901(completeEgovSsoTestProfile);

    expect(result).toMatchObject({
      registration: {
        philsysCardNumber: "0000-0000-0000-0001",
      },
      taxpayerInformation: {
        tin: "12345678900000",
        taxpayerName: {
          firstName: "Juan",
          middleName: "Santos",
          lastName: "Dela Cruz",
          suffix: "Jr.",
        },
        gender: "male",
        civilStatus: "married",
        birthOrOrganizationDate: "1990-01-23",
        placeOfBirth: "Manila, Metro Manila, Philippines",
        motherMaidenName: "Elena Garcia Reyes",
        fatherName: "Roberto Dela Cruz",
        citizenship: "Filipino",
        localResidenceAddress: {
          unitRoomFloorBuildingNo: "Unit 4B",
          lotBlockPhaseHouseNo: "123",
          streetName: "Mabini Street",
          barangay: "Barangay San Isidro",
          municipalityCity: "Quezon City",
          province: "Metro Manila",
          zipCode: "1100",
        },
        foreignAddress: "100 Example Avenue, Sample City, 00000, Example Country",
        identification: {
          type: "Passport",
          idNumber: "P0000001",
          effectivityDate: "2023-06-15",
          expiryDate: "2033-06-14",
          placeCountryOfIssue: "Paranaque City, PH",
        },
        contact: {
          preferredTypes: ["mobile"],
          mobile: "+639170000000",
          email: "juan.complete@example.test",
        },
      },
      paymentOrder: {
        taxpayerTin: "12345678900000",
        taxpayerName: "Juan Santos Dela Cruz Jr.",
      },
    });
    expect(result.declaration?.signatureSource).toStartWith("data:image/png;base64,");
    expect(bir1901DataSchema.safeParse(result).success).toBe(true);
  });

  test("uses the fallback TIN for an unrecognized opaque value", () => {
    const profile: EgovSsoCitizenProfile = {
      ...completeEgovSsoTestProfile,
      tin_id: { opaque_identifier: "123-456-789-00000" },
    };

    expect(mapEgovProfileToBir1901(profile).taxpayerInformation?.tin).toBe("000999999000");
  });

  test("normalizes an entirely absent profile without throwing", () => {
    const result = mapEgovProfileToBir1901(undefined);
    expect(bir1901DataSchema.safeParse(result).success).toBe(true);
    expect(result.taxpayerInformation?.taxpayerName?.firstName).toBeUndefined();
    expect(result.paymentOrder?.taxpayerTin).toBe("000999999000");
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
      taxpayerInformation: {
        tin: "123456789",
        taxpayerName: {
          firstName: "Josie",
        },
        fatherName: "Roberto",
        localResidenceAddress: {
          lotBlockPhaseHouseNo: "1",
          streetName: "Example Street",
          barangay: "San Isidro",
          municipalityCity: "Quezon City",
        },
        identification: {
          type: "Passport",
          idNumber: "P1234567",
        },
      },
      paymentOrder: {
        taxpayerName: "Josie",
        taxpayerTin: "123456789",
      },
    });
    expect(result.registration?.philsysCardNumber).toBeUndefined();
    expect(result.declaration?.signatureSource).toBeUndefined();
  });

  test("uses the combined profile address when no structured street is available", () => {
    const result = mapEgovProfileToBir1901({
      address: "Fallback Residence Address",
      first_name: "Juan",
    });

    expect(result.taxpayerInformation?.localResidenceAddress?.streetName).toBe(
      "Fallback Residence Address",
    );
  });

  test("does not pass a remote profile signature URL to the PDF generator", () => {
    const result = mapEgovProfileToBir1901({
      first_name: "Juan",
      signature_url: "https://assets.example.test/user-signature.png",
    });

    expect(result.declaration?.signatureSource).toBeUndefined();
  });
});

describe("mapEgovProfileToBir1905", () => {
  test("maps the authoritative Form 1905 identity fields", () => {
    const result = mapEgovProfileToBir1905(completeEgovSsoTestProfile);

    expect(result).toMatchObject({
      taxpayerInformation: {
        tin: "12345678900000",
        contactNumber: "+639170000000",
        registeredName: "Dela Cruz, Juan, Santos, Jr.",
      },
      declaration: {
        printedName: "Dela Cruz, Juan, Santos, Jr.",
      },
    });
    expect(result.declaration?.signatureSource).toStartWith("data:image/png;base64,");
    expect(bir1905DataSchema.safeParse(result).success).toBe(true);
  });

  test("does not pass a remote profile signature URL to the PDF generator", () => {
    const result = mapEgovProfileToBir1905({
      first_name: "Juan",
      signature_url: "https://assets.example.test/user-signature.png",
    });

    expect(result.declaration?.signatureSource).toBeUndefined();
  });
});
