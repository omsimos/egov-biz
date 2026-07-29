import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  bir1901DataSchema,
  generateBirFormInputSchema,
  type GenerateBirFormInput,
} from "@/lib/bir-form/schema";

describe("generateBirFormInputSchema", () => {
  test("narrows Form 1901 data from the required discriminator", () => {
    const input: GenerateBirFormInput = {
      type: "1901",
      data: {
        taxpayerInformation: {
          tin: "123-456-789-00000",
          taxpayerName: { firstName: "Juan", lastName: "Dela Cruz" },
          birthOrOrganizationDate: "1990-01-23",
          eightPercentIncomeTaxRate: "yes",
        },
        invoices: {
          birPrintedInvoices: {
            intendsToUse: "yes",
            type: "nonVat",
            numberOfBooklets: 2,
          },
        },
      },
    };

    const parsed = generateBirFormInputSchema.parse(input);
    expect(parsed.type).toBe("1901");
    expect(parsed.data.invoices?.birPrintedInvoices?.numberOfBooklets).toBe(2);
  });

  test("allows an empty Form 1901 draft because every data field is optional", () => {
    expect(generateBirFormInputSchema.parse({ type: "1901", data: {} })).toEqual({
      type: "1901",
      data: {},
    });
  });

  test("serializes the discriminator and form data as a tool-compatible JSON Schema", () => {
    expect(z.toJSONSchema(generateBirFormInputSchema)).toMatchObject({
      oneOf: [
        {
          properties: {
            type: { const: "1901" },
            data: { type: "object" },
          },
          required: ["type", "data"],
          type: "object",
        },
      ],
    });
  });

  test("rejects unsupported form discriminators and unknown fields", () => {
    expect(generateBirFormInputSchema.safeParse({ type: "2303", data: {} }).success).toBe(false);
    expect(
      bir1901DataSchema.safeParse({
        taxpayerInformation: { inventedField: "not on the PDF" },
      }).success,
    ).toBe(false);
  });

  test("validates dates, contact values, TINs, ZIP codes, and numeric fields", () => {
    const invalid = bir1901DataSchema.safeParse({
      taxpayerInformation: {
        tin: "1234",
        birthOrOrganizationDate: "01/23/1990",
        localResidenceAddress: { zipCode: "11001" },
        contact: { email: "not-an-email", mobile: "call me" },
      },
      paymentOrder: {
        totalAmountPayable: -1,
      },
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues.length).toBeGreaterThanOrEqual(6);
  });

  test("accepts data from every page of the supplied Form 1901", () => {
    const result = bir1901DataSchema.safeParse({
      registration: { registeringOffice: "headOffice" },
      taxpayerInformation: { taxpayerType: "professionalGeneral" },
      taxpayerClassification: { expectedAnnualGrossSales: "micro" },
      spouseInformation: { employmentStatus: "unemployed" },
      authorizedRepresentative: { addressType: "residence" },
      businessInformation: { singleBusinessNumber: "PBN-001" },
      facilityDetails: { facilityType: "warehouse" },
      taxTypes: {
        incomeTax: { individualIncomeTax: { selected: true, formType: "1701", atc: "II012" } },
      },
      invoices: {
        authorityToPrint: {
          descriptions: [{ description: "Sales invoice", type: "nonVat" }],
        },
      },
      multipleEmployments: {
        type: "successive",
        employers: [{ name: "Example Employer", tin: "123-456-789" }],
      },
      declaration: { printedName: "Juan Dela Cruz" },
      paymentOrder: { year: 2026, totalAmountPayable: 30 },
      documentaryRequirements: {
        selfEmployed: { governmentIssuedId: true },
      },
      voluntaryPaymentDeclaration: {
        printedName: "Juan Dela Cruz",
        titlePosition: "Taxpayer",
      },
    });

    expect(result.success).toBe(true);
  });
});
