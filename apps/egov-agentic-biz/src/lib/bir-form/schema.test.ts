import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  bir1901DataSchema,
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
    expect(parsed.data.invoices?.birPrintedInvoices?.numberOfBooklets).toBe(2);
  });

  test("allows an empty Form 1901 draft because every data field is optional", () => {
    expect(generateBirFormInputSchema.parse({ type: "1901", data: {} })).toEqual({
      type: "1901",
      data: {},
    });
  });

  test("serializes the discriminator and form data as a tool-compatible JSON Schema", () => {
    const jsonSchema = z.toJSONSchema(generateBirFormInputSchema);
    expect(jsonSchema).toMatchObject({
      description: "Generate-BIR-form input selected by its form type discriminator.",
      oneOf: [
        {
          properties: {
            type: {
              const: "1901",
              description: 'BIR form discriminator. Use "1901".',
            },
            data: {
              description: "Form-specific values for BIR Form 1901. Every field is optional.",
              type: "object",
            },
          },
          required: ["type", "data"],
          type: "object",
        },
      ],
    });
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
});
