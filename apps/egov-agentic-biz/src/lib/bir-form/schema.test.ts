import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  bir1901DataSchema,
  bir1905DataSchema,
  generateBirFormInputSchema,
  type GenerateBirFormInput,
} from "@/lib/bir-form/schema";

function propertiesMissingDescriptions(value: unknown, path = "schema"): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const schema = value as Record<string, unknown>;
  const missing: string[] = [];
  const properties = schema.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    for (const [name, property] of Object.entries(properties)) {
      const propertyPath = `${path}.${name}`;
      if (
        !property ||
        typeof property !== "object" ||
        Array.isArray(property) ||
        typeof (property as Record<string, unknown>).description !== "string"
      )
        missing.push(propertyPath);
      missing.push(...propertiesMissingDescriptions(property, propertyPath));
    }
  }
  if (schema.items) missing.push(...propertiesMissingDescriptions(schema.items, `${path}[]`));
  for (const keyword of ["oneOf", "anyOf", "allOf"] as const) {
    const branches = schema[keyword];
    if (Array.isArray(branches))
      for (const [index, branch] of branches.entries())
        missing.push(...propertiesMissingDescriptions(branch, `${path}.${keyword}[${index}]`));
  }
  return missing;
}

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
    if (parsed.type === "1901") {
      expect(parsed.data.invoices?.birPrintedInvoices?.numberOfBooklets).toBe(2);
    }
  });

  test("allows an empty Form 1901 draft because every data field is optional", () => {
    expect(generateBirFormInputSchema.parse({ type: "1901", data: {} })).toEqual({
      type: "1901",
      data: {},
    });
  });

  test("narrows Form 1905 data from the required discriminator", () => {
    const input: GenerateBirFormInput = {
      type: "1905",
      data: {
        taxpayerInformation: {
          tin: "123-456-789-00000",
          registeredName: "Dela Cruz, Juan Santos",
        },
        registrationInformationUpdate: {
          registeredAddress: {
            selected: true,
            transferToAnotherRdo: true,
            oldRdoCode: "039",
            newRdoCode: "040",
          },
        },
      },
    };

    const parsed = generateBirFormInputSchema.parse(input);
    expect(parsed.type).toBe("1905");
    if (parsed.type === "1905") {
      expect(parsed.data.registrationInformationUpdate?.registeredAddress?.newRdoCode).toBe("040");
    }
  });

  test("allows an empty Form 1905 draft because every data field is optional", () => {
    expect(generateBirFormInputSchema.parse({ type: "1905", data: {} })).toEqual({
      type: "1905",
      data: {},
    });
  });

  test("serializes the discriminator and form data as a tool-compatible JSON Schema", () => {
    const jsonSchema = z.toJSONSchema(generateBirFormInputSchema);
    expect(jsonSchema.description).toBe(
      "Generate-BIR-form input selected by its form type discriminator.",
    );
    expect(jsonSchema.oneOf).toHaveLength(2);
    expect(jsonSchema.oneOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          properties: expect.objectContaining({
            type: {
              const: "1901",
              description: 'BIR form discriminator. Use "1901".',
              type: "string",
            },
            data: expect.objectContaining({
              description: "Form-specific values for BIR Form 1901. Every field is optional.",
              type: "object",
            }),
          }),
        }),
        expect.objectContaining({
          properties: expect.objectContaining({
            type: {
              const: "1905",
              description: 'BIR form discriminator. Use "1905".',
              type: "string",
            },
            data: expect.objectContaining({
              description: "Form-specific values for BIR Form 1905. Every field is optional.",
              type: "object",
            }),
          }),
        }),
      ]),
    );
    expect(propertiesMissingDescriptions(jsonSchema)).toEqual([]);
  });

  test("rejects unsupported form discriminators while tolerating extra object fields", () => {
    expect(generateBirFormInputSchema.safeParse({ type: "2303", data: {} }).success).toBe(false);
    expect(
      bir1901DataSchema.parse({
        taxpayerInformation: { inventedField: "not on the PDF" },
      }),
    ).toEqual({ taxpayerInformation: {} });
  });

  test("accepts loosely formatted field values without format or range enforcement", () => {
    const result = bir1901DataSchema.safeParse({
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

    expect(result.success).toBe(true);
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

  test("accepts data from every page of the supplied Form 1905", () => {
    const result = bir1905DataSchema.safeParse({
      taxpayerInformation: {
        tin: "1234",
        rdoCode: "040",
        contactNumber: "call me",
        registeredName: "Dela Cruz, Juan",
      },
      replacementOrCancellation: {
        forms: { certificateOfRegistration: true },
        reasons: { lostOrDamaged: true },
      },
      otherUpdates: { registerOrUpdateBooks: true },
      registrationInformationUpdate: {
        registeredOrTradeName: {
          selected: true,
          changeTradeName: true,
          oldName: "Old Trade",
          newName: "New Trade",
        },
        registeredAddress: {
          selected: true,
          transferToAnotherRdo: true,
          newAddress: { municipalityCity: "Quezon City", zipCode: "11001" },
        },
        accountingPeriod: {
          selected: true,
          calendarToFiscal: {
            selected: true,
            accountingStartMonth: "13",
            effectivityDate: "any date",
          },
        },
        registeredActivity: {
          selected: true,
          newActivityOrLineOfBusiness: "Consulting",
        },
        facilityDetails: {
          selected: true,
          facilities: [{ facilityCode: "F01", facilityTypes: ["warehouse"] }],
        },
        incentiveDetails: {
          selected: true,
          investmentPromotionAgency: "Example Agency",
        },
        taxTypeDetails: {
          selected: true,
          cancelled: [{ taxType: "VAT", formType: "2550Q", atc: "VT010" }],
        },
        contactType: {
          selected: true,
          contactTypes: ["mobile"],
          contactNumber: "+639170000000",
          email: "not-an-email",
        },
        contactPerson: {
          selected: true,
          registeredName: "Dela Cruz, Maria",
        },
        relatedParties: {
          selected: true,
          parties: [{ registeredName: "Example Partner", tin: "1234" }],
        },
      },
      closureOrCancellation: {
        cancellationOfTin: { selected: true, death: true },
      },
      civilStatusChange: {
        changeType: "singleToMarried",
        spouse: { employmentStatus: "employedLocally", name: "Dela Cruz, Maria" },
      },
      booksOfAccounts: {
        books: [
          {
            type: "manual",
            booksToBeRegistered: "General Journal",
            quantity: -1,
          },
        ],
        registrations: [{ permitNumber: "PTU-001" }],
      },
      otherUpdateOrCorrection: { details: "Other correction" },
      declaration: { printedName: "Dela Cruz, Juan" },
      documentaryRequirements: {
        tinCardIssuance: { governmentIssuedId: true },
        manualBooks: { permanentlyBoundBooks: true },
        businessTransferNewRdo: { birForm1905Copies: true },
      },
    });

    expect(result.success).toBe(true);
  });
});
