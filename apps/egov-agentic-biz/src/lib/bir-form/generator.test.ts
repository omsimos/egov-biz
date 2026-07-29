import { describe, expect, spyOn, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { completeBir1901Fixture, completeBir1905Fixture } from "@/lib/bir-form/all-fields-fixture";
import { generateBir1905Pdf } from "@/lib/bir-form/generator-1905";
import { generateBir1901Pdf } from "@/lib/bir-form/generator";

const template1901Path = fileURLToPath(
  new URL("../../../public/forms/bir-form-1901.pdf", import.meta.url),
);
const template1905Path = fileURLToPath(
  new URL("../../../public/forms/bir-form-1905.pdf", import.meta.url),
);

async function drawnText(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const textOperands: string[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    if (!(contents instanceof PDFArray)) continue;
    for (let index = 0; index < contents.size(); index += 1) {
      const stream = pdf.context.lookup(contents.get(index));
      if (!(stream instanceof PDFRawStream)) continue;
      const decoded = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      for (const match of decoded.matchAll(/<([0-9a-f]+)>/gi)) {
        const encoded = match[1];
        if (encoded) textOperands.push(Buffer.from(encoded, "hex").toString("latin1"));
      }
    }
  }
  return {
    checks: textOperands.filter((value) => value === "X").length,
    compact: textOperands.join("").replaceAll(/\s/g, ""),
  };
}

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
      template1901Path,
    );

    expect(result.pageCount).toBe(4);
    expect(result.size).toBeGreaterThan(100_000);

    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("BIR Form 1901 - Prefilled Draft");
  });

  test("renders every Form 1901 schema field from the complete fixture", async () => {
    const fixture = completeBir1901Fixture();
    const result = await generateBir1901Pdf(fixture.data, template1901Path);

    expect(fixture.markers.length).toBeGreaterThan(100);
    expect(result.pageCount).toBe(4);
    expect(result.size).toBeGreaterThan(100_000);
    const rendered = await drawnText(result.bytes);
    for (const { marker } of fixture.markers) expect(rendered.compact).toContain(marker);
    expect(rendered.checks).toBe(77);
  });

  test("normalizes common symbols and rejects identity text the template cannot render", async () => {
    const result = await generateBir1901Pdf(
      { taxpayerInformation: { taxpayerName: { firstName: "Juan ₱" } } },
      template1901Path,
    );
    expect((await drawnText(result.bytes)).compact).toContain("JuanPHP");

    await expect(
      generateBir1901Pdf(
        { taxpayerInformation: { taxpayerName: { lastName: "Dela Cruz 李" } } },
        template1901Path,
      ),
    ).rejects.toThrow("cannot render Unicode character U+674E");
  });
});

describe("generateBir1905Pdf", () => {
  test("renders a valid four-page PDF from optional Form 1905 data", async () => {
    const result = await generateBir1905Pdf(
      {
        taxpayerInformation: {
          tin: "123-456-789-00000",
          rdoCode: "040",
          registeredName: "Dela Cruz, Juan Santos",
        },
        registrationInformationUpdate: {
          registeredAddress: {
            selected: true,
            transferToAnotherRdo: true,
            oldRdoCode: "039",
            newRdoCode: "040",
            newAddress: {
              streetName: "123 Mabini Street",
              municipalityCity: "Quezon City",
              province: "Metro Manila",
              zipCode: "1100",
            },
          },
        },
        documentaryRequirements: {
          businessTransferNewRdo: { birForm1905Copies: true },
        },
      },
      template1905Path,
    );

    expect(result.pageCount).toBe(4);
    expect(result.size).toBeGreaterThan(100_000);

    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("BIR Form 1905 - Prefilled Draft");
  });

  test("renders every Form 1905 schema field from the complete fixture", async () => {
    const fixture = completeBir1905Fixture();
    const result = await generateBir1905Pdf(fixture.data, template1905Path);

    expect(fixture.markers.length).toBeGreaterThan(50);
    expect(result.pageCount).toBe(4);
    expect(result.size).toBeGreaterThan(100_000);
    const rendered = await drawnText(result.bytes);
    for (const { marker } of fixture.markers) expect(rendered.compact).toContain(marker);
    expect(rendered.checks).toBe(83);
  });

  test("renders the form labels for loose-leaf and computerized book rows", async () => {
    const result = await generateBir1905Pdf(
      {
        booksOfAccounts: {
          books: [
            { type: "looseLeaf", booksToBeRegistered: "BOOK-A" },
            { type: "computerized", booksToBeRegistered: "BOOK-B" },
          ],
        },
      },
      template1905Path,
    );

    const rendered = await drawnText(result.bytes);
    expect(rendered.compact).toContain("LooseBOOK-A");
    expect(rendered.compact).toContain("CBABOOK-B");
    expect(rendered.compact).not.toContain("looseLeaf");
    expect(rendered.compact).not.toContain("computerized");
  });

  test("does not duplicate the preprinted facility-code prefix", async () => {
    const result = await generateBir1905Pdf(
      {
        registrationInformationUpdate: {
          facilityDetails: { facilities: [{ facilityCode: "F01" }] },
        },
      },
      template1905Path,
    );
    const rendered = await drawnText(result.bytes);
    expect(rendered.compact).toContain("01");
    expect(rendered.compact).not.toContain("F01");
  });

  test("normalizes common symbols and rejects identity text the template cannot render", async () => {
    const result = await generateBir1905Pdf(
      { taxpayerInformation: { registeredName: "Juan ₱" } },
      template1905Path,
    );
    expect((await drawnText(result.bytes)).compact).toContain("JuanPHP");

    await expect(
      generateBir1905Pdf({ taxpayerInformation: { registeredName: "Juan 李" } }, template1905Path),
    ).rejects.toThrow("cannot render Unicode character U+674E");
  });

  test("adds continuation pages for overflow rows and ignores an unusable signature", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = await generateBir1905Pdf(
        {
          taxpayerInformation: {
            tin: "123-456-789-00000",
            registeredName: "Overflow Test Taxpayer",
          },
          registrationInformationUpdate: {
            facilityDetails: {
              facilities: Array.from({ length: 3 }, (_, index) => ({
                facilityCode: `F${index + 1}`,
                facilityTypes: ["warehouse"] as const,
              })),
            },
            taxTypeDetails: {
              cancelled: [{ taxType: "Income tax" }, { taxType: "Percentage tax continuation" }],
              reRegisteredOrAdded: [
                { taxType: "VAT" },
                { taxType: "Withholding tax continuation" },
              ],
              suspended: [{ taxType: "Excise tax" }, { taxType: "Documentary stamp continuation" }],
            },
            relatedParties: {
              parties: Array.from({ length: 6 }, (_, index) => ({
                registeredName: `Related party ${index + 1}`,
              })),
            },
          },
          booksOfAccounts: {
            books: Array.from({ length: 7 }, (_, index) => ({
              booksToBeRegistered: `Book ${index + 1}`,
            })),
            registrations: Array.from({ length: 7 }, (_, index) => ({
              permitNumber: `PERMIT-${index + 1}`,
            })),
          },
          declaration: {
            signatureSource: "https://untrusted.example.test/signature.png",
          },
        },
        template1905Path,
      );

      expect(result.pageCount).toBeGreaterThan(4);
      expect(warn).toHaveBeenCalledTimes(1);
      expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(result.pageCount);
    } finally {
      warn.mockRestore();
    }
  });
});
