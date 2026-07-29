import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { generateBir1901Pdf } from "@/lib/bir-form/generator";

const templatePath = fileURLToPath(
  new URL("../../../public/forms/bir-form-1901.pdf", import.meta.url),
);

describe("generateBir1901Pdf", () => {
  test("renders a valid four-page PDF from optional Form 1901 data", async () => {
    const result = await generateBir1901Pdf(
      {
        taxpayerInformation: {
          taxpayerName: { firstName: "Juan", lastName: "Dela Cruz" },
          birthOrOrganizationDate: "1990-01-23",
          contact: { email: "juan@example.test" },
        },
        invoices: {
          authorityToPrint: {
            descriptions: [{ description: "Sales invoice", type: "nonVat" }],
          },
        },
        documentaryRequirements: {
          selfEmployed: { governmentIssuedId: true },
        },
      },
      templatePath,
    );

    expect(result.pageCount).toBe(4);
    expect(result.size).toBeGreaterThan(100_000);

    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("BIR Form 1901 - Prefilled Draft");
  });
});
