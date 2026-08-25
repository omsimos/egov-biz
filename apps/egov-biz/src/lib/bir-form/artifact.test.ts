import { describe, expect, test } from "bun:test";
import {
  bir1901TaxpayerTypeForBusinessType,
  currentBirRegistrationDate,
  mergeBir1901Data,
  mergeBir1901DataForBusinessType,
  mergeBir1905Data,
} from "@/lib/bir-form/artifact";

describe("mergeBir1901Data", () => {
  test("uses the current Philippine date for Form 1901 registration", () => {
    expect(currentBirRegistrationDate(new Date("2026-07-29T16:30:00.000Z"))).toBe("2026-07-30");
  });

  test("lets supplied form data override profile defaults without losing sibling values", () => {
    const merged = mergeBir1901Data(
      {
        taxpayerInformation: {
          taxpayerName: {
            firstName: "Profile First",
            lastName: "Profile Last",
          },
          contact: {
            email: "profile@example.test",
            preferredTypes: ["mobile"],
          },
        },
      },
      {
        taxpayerInformation: {
          taxpayerName: {
            firstName: "Supplied First",
          },
          contact: {
            preferredTypes: ["landline", "mobile"],
          },
        },
      },
    );

    expect(merged).toMatchObject({
      taxpayerInformation: {
        taxpayerName: {
          firstName: "Supplied First",
          lastName: "Profile Last",
        },
        contact: {
          email: "profile@example.test",
          preferredTypes: ["landline", "mobile"],
        },
      },
    });
  });

  test("maps app business types to their Form 1901 taxpayer types", () => {
    expect(bir1901TaxpayerTypeForBusinessType("Sole proprietor")).toBe(
      "singleProprietorshipResidentCitizen",
    );
    expect(bir1901TaxpayerTypeForBusinessType("Self-employed")).toBe("professionalGeneral");
    expect(bir1901TaxpayerTypeForBusinessType("Company")).toBeUndefined();
  });

  test("uses the known business type for Form 1901", () => {
    const data = mergeBir1901DataForBusinessType(
      {
        taxpayerInformation: {
          taxpayerName: { firstName: "Josie" },
        },
      },
      {
        taxpayerInformation: {
          taxpayerType: "professionalLicensed",
        },
      },
      "Self-employed",
    );

    expect(data.taxpayerInformation).toMatchObject({
      taxpayerName: { firstName: "Josie" },
      taxpayerType: "professionalGeneral",
    });
  });
});

describe("mergeBir1905Data", () => {
  test("lets supplied Form 1905 data override profile defaults", () => {
    const merged = mergeBir1905Data(
      {
        taxpayerInformation: {
          tin: "123456789",
          registeredName: "Profile Name",
        },
      },
      {
        taxpayerInformation: {
          registeredName: "Corrected Name",
        },
        otherUpdates: {
          changeOfCivilStatus: true,
        },
      },
    );

    expect(merged).toEqual({
      taxpayerInformation: {
        tin: "123456789",
        registeredName: "Corrected Name",
      },
      otherUpdates: {
        changeOfCivilStatus: true,
      },
    });
  });
});
