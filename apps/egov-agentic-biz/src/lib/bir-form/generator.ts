import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Bir1901ProfileInput } from "@/lib/bir-form/profile";

type TextField = {
  fontSize?: number;
  maxWidth: number;
  minFontSize?: number;
  x: number;
  y: number;
};

export const DEFAULT_BIR_1901_TEMPLATE = "public/forms/bir-form-1901.pdf";

export function bir1901TemplatePath() {
  const configured = process.env.BIR_FORM_1901_TEMPLATE_PATH?.trim();
  if (configured) return resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  return join(process.cwd(), "public", "forms", "bir-form-1901.pdf");
}

function fitFontSize(
  font: PDFFont,
  value: string,
  requested: number,
  maxWidth: number,
  minimum = 5.5,
) {
  let size = requested;
  while (size > minimum && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.25;
  return size;
}

function drawText(page: PDFPage, font: PDFFont, value: string, field: TextField) {
  const text = value.trim();
  if (!text) return;
  const fontSize = fitFontSize(font, text, field.fontSize ?? 8, field.maxWidth, field.minFontSize);
  page.drawText(text, {
    color: rgb(0.05, 0.12, 0.3),
    font,
    maxWidth: field.maxWidth,
    size: fontSize,
    x: field.x,
    y: field.y,
  });
}

function drawCheck(page: PDFPage, font: PDFFont, x: number, y: number) {
  page.drawText("X", { color: rgb(0.05, 0.12, 0.3), font, size: 9, x, y });
}

function drawCenteredText(page: PDFPage, font: PDFFont, value: string, field: TextField) {
  const text = value.trim();
  if (!text) return;
  const fontSize = fitFontSize(font, text, field.fontSize ?? 8, field.maxWidth, field.minFontSize);
  const width = font.widthOfTextAtSize(text, fontSize);
  drawText(page, font, text, {
    ...field,
    fontSize,
    x: field.x + Math.max(0, (field.maxWidth - width) / 2),
  });
}

function normalizedDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value.trim();
}

function addressParts(profile: Bir1901ProfileInput) {
  const known = new Set(
    [profile.barangay, profile.city, profile.province]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const parts = profile.address
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const zip = profile.postal.trim() || parts.find((part) => /^\d{4}$/.test(part)) || "";
  const unclassified = parts.filter((part) => !known.has(part.toLowerCase()) && part !== zip);
  const houseNumber =
    unclassified.find((part) => /^\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?$/.test(part)) ?? "";
  const explicitStreet = profile.street.trim();
  const explicitMatch = /^(\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?)\s+(.+)$/.exec(explicitStreet);
  const streetHouseNumber = explicitMatch?.[1] ?? "";
  const street =
    explicitMatch?.[2] ??
    (explicitStreet || unclassified.find((part) => part !== houseNumber) || "");
  return { houseNumber: streetHouseNumber || houseNumber, street, zip };
}

function drawTin(page: PDFPage, font: PDFFont, value: string) {
  const digits = value.replaceAll(/\D/g, "");
  if (digits.length < 9) return;
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)];
  const fields = [
    { maxWidth: 43, x: 219, y: 753 },
    { maxWidth: 43, x: 276, y: 753 },
    { maxWidth: 43, x: 333, y: 753 },
  ] satisfies TextField[];
  for (const [index, group] of groups.entries()) {
    const field = fields[index];
    if (field) drawCenteredText(page, font, group ?? "", { ...field, fontSize: 10 });
  }
}

function drawPaymentOrderTin(page: PDFPage, font: PDFFont, value: string) {
  const digits = value.replaceAll(/\D/g, "");
  if (digits.length < 9) return;
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)];
  const fields = [
    { maxWidth: 42, x: 133, y: 187 },
    { maxWidth: 42, x: 191, y: 187 },
    { maxWidth: 42, x: 248, y: 187 },
    { maxWidth: 70, x: 306, y: 187 },
  ] satisfies TextField[];
  for (const [index, group] of groups.entries()) {
    const field = fields[index];
    if (field) drawCenteredText(page, font, group ?? "", { ...field, fontSize: 9 });
  }
}

async function signatureImage(pdf: PDFDocument, source: string) {
  const value = source.trim();
  if (!value) return null;

  let bytes: Uint8Array;
  const dataImage = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (dataImage?.[1] && dataImage[2]) {
    bytes = Buffer.from(dataImage[2].replaceAll(/\s/g, ""), "base64");
  } else if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 100) {
    bytes = Buffer.from(value.replaceAll(/\s/g, ""), "base64");
  } else {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Signature URL must use HTTPS");
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    const contentLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
    if (!response.ok) throw new Error("Signature URL could not be loaded");
    if (contentLength > 2_000_000) throw new Error("Signature image is too large");
    bytes = new Uint8Array(await response.arrayBuffer());
  }

  if (bytes.byteLength > 2_000_000) throw new Error("Signature image is too large");
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isPng) return pdf.embedPng(bytes);
  if (isJpeg) return pdf.embedJpg(bytes);
  throw new Error("Signature image must be PNG or JPEG");
}

export async function generateBir1901Pdf(profile: Bir1901ProfileInput, templatePath: string) {
  const templateBytes = await readFile(templatePath);
  const pdf = await PDFDocument.load(templateBytes);
  if (pdf.getPageCount() !== 4)
    throw new Error("Expected the four-page October 2025 BIR 1901 template");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page1 = pdf.getPage(0);
  const page3 = pdf.getPage(2);
  const { houseNumber, street, zip } = addressParts(profile);

  // Items 3 and 4: document identifiers are filled only when the SSO profile
  // supplies an explicit PCN and an unambiguous TIN value.
  drawCenteredText(page1, fontBold, profile.nationalIdPcn, {
    fontSize: 9,
    maxWidth: 184,
    x: 391,
    y: 786,
  });
  drawTin(page1, fontBold, profile.tin);

  // Item 7: exact server-only SSO name components.
  drawText(page1, fontBold, profile.lastName, { maxWidth: 139, x: 32, y: 588 });
  drawText(page1, fontBold, profile.firstName, { maxWidth: 139, x: 192, y: 588 });
  drawText(page1, fontBold, profile.middleName, { maxWidth: 130, x: 349, y: 588 });
  drawText(page1, fontBold, profile.suffix, {
    fontSize: 7,
    maxWidth: 27,
    x: 495,
    y: 588,
  });

  if (/^male$/i.test(profile.gender)) drawCheck(page1, fontBold, 76, 545.5);
  if (/^female$/i.test(profile.gender)) drawCheck(page1, fontBold, 134, 545.5);
  if (/^single$/i.test(profile.civilStatus)) drawCheck(page1, fontBold, 264, 545.5);
  if (/^married$/i.test(profile.civilStatus)) drawCheck(page1, fontBold, 335, 545.5);
  if (/^(?:widow(?:er|ed)?)$/i.test(profile.civilStatus)) drawCheck(page1, fontBold, 409, 545.5);
  if (/^(?:legally\s+)?separated$/i.test(profile.civilStatus))
    drawCheck(page1, fontBold, 482, 545.5);
  drawText(page1, font, normalizedDate(profile.birthDate), {
    fontSize: 7.5,
    maxWidth: 108,
    x: 231,
    y: 527,
  });
  drawText(page1, font, profile.birthPlace, { maxWidth: 125, x: 467, y: 527 });
  drawText(page1, font, profile.motherMaidenName, { maxWidth: 170, x: 133, y: 510 });
  drawText(page1, font, profile.fatherName, { maxWidth: 184, x: 409, y: 510 });
  drawText(page1, font, profile.nationality, { maxWidth: 168, x: 133, y: 497 });

  // Item 16: fill only address components that the authenticated bounded profile carries.
  drawText(page1, font, profile.addressLine2, { maxWidth: 82, x: 32, y: 460.5 });
  drawText(page1, font, houseNumber, { maxWidth: 82, x: 233, y: 460.5 });
  drawText(page1, font, street, { maxWidth: 112, x: 334, y: 460.5 });
  drawText(page1, font, profile.barangay, { maxWidth: 111, x: 32, y: 436 });
  drawText(page1, font, profile.city, { maxWidth: 114, x: 276, y: 436 });
  drawText(page1, font, profile.province, { maxWidth: 113, x: 408, y: 436 });
  drawText(page1, font, zip, { maxWidth: 40, x: 537, y: 436 });

  // Item 18 accepts a recognizable foreign-address string or object from SSO.
  drawText(page1, font, profile.foreignAddress, {
    maxWidth: 486,
    x: 105,
    y: 358.5,
  });

  // Item 21: passport is the only typed government ID with issue and expiry metadata.
  if (profile.passportNumber.trim()) {
    drawText(page1, font, "Passport", { maxWidth: 56, x: 32, y: 304.5 });
    drawText(page1, font, profile.passportNumber, { maxWidth: 73, x: 102, y: 304.5 });
    drawText(page1, font, normalizedDate(profile.passportIssuedDate), {
      fontSize: 6.5,
      maxWidth: 114,
      x: 190,
      y: 304.5,
    });
    drawText(page1, font, normalizedDate(profile.passportExpiryDate), {
      fontSize: 6.5,
      maxWidth: 117,
      x: 319,
      y: 304.5,
    });
    drawText(page1, font, profile.passportPlaceIssued, {
      fontSize: 6,
      maxWidth: 55,
      minFontSize: 2.75,
      x: 523,
      y: 304.5,
    });
  }

  // Item 22: preferred contact details.
  if (profile.mobile.trim()) drawCheck(page1, fontBold, 207, 282.5);
  drawText(page1, font, profile.mobile, { maxWidth: 70, x: 205, y: 266 });
  drawText(page1, font, profile.email, { maxWidth: 285, x: 291, y: 266 });

  // Item 50 is an unsplit taxpayer-name field and can safely use the verified full name.
  drawText(page3, fontBold, profile.fullName, {
    fontSize: 8,
    maxWidth: 430,
    x: 134,
    y: 161,
  });
  drawPaymentOrderTin(page3, fontBold, profile.tin);

  // Item 46: signature image over the declaration signature line.
  let signature = null;
  try {
    signature = await signatureImage(pdf, profile.signatureSource);
  } catch (error) {
    console.warn("BIR form signature image could not be embedded", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
  if (signature) {
    const natural = signature.scale(1);
    const scale = Math.min(125 / natural.width, 34 / natural.height, 1);
    const width = natural.width * scale;
    const height = natural.height * scale;
    page3.drawImage(signature, {
      height,
      width,
      x: 174 + (136 - width) / 2,
      y: 313,
    });
  }

  pdf.setTitle("BIR Form 1901 - Prefilled Draft");
  pdf.setSubject("Draft prefilled from the authenticated eGov SSO profile");
  pdf.setProducer("eGovPH Business prototype");
  const outputBytes = await pdf.save();
  return { bytes: outputBytes, pageCount: pdf.getPageCount(), size: outputBytes.byteLength };
}

export async function writeBir1901Pdf(
  profile: Bir1901ProfileInput,
  templatePath: string,
  outputPath: string,
) {
  const result = await generateBir1901Pdf(profile, templatePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.bytes);
  return { outputPath, pageCount: result.pageCount, size: result.size };
}
