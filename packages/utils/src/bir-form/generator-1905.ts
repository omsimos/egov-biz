import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { dateCellLayout, normalizedDate } from "./date-cells.js";
import { standardFontText } from "./pdf-text.js";
import type { Bir1905Data } from "./schema.js";

type TextField = {
  fontSize?: number;
  maxWidth: number;
  x: number;
  y: number;
};

type ContinuationEntry = {
  fields: Array<readonly [label: string, value: unknown]>;
  heading: string;
};

type Address = NonNullable<
  NonNullable<
    NonNullable<Bir1905Data["registrationInformationUpdate"]>["registeredAddress"]
  >["newAddress"]
>;

const INK = rgb(0.05, 0.12, 0.3);
const BOOK_TYPE_LABELS = {
  computerized: "CBA",
  looseLeaf: "Loose",
  manual: "Manual",
} as const;

export const DEFAULT_BIR_1905_TEMPLATE = "public/forms/bir-form-1905.pdf";

export function bir1905TemplatePath() {
  const configured = process.env.BIR_FORM_1905_TEMPLATE_PATH?.trim();
  if (configured) return resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  return join(process.cwd(), "public", "forms", "bir-form-1905.pdf");
}

function printable(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function bookTypeLabel(type: "computerized" | "looseLeaf" | "manual" | undefined) {
  return type ? BOOK_TYPE_LABELS[type] : undefined;
}

function facilityCodeSuffix(value: string | undefined) {
  return value?.replace(/^F\s*/i, "");
}

function fitFontSize(font: PDFFont, value: string, requested: number, maxWidth: number) {
  let size = requested;
  while (size > 4.5 && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.25;
  return size;
}

function drawText(page: PDFPage, font: PDFFont, value: unknown, field: TextField) {
  const text = standardFontText(font, printable(value));
  if (!text) return;
  const fontSize = fitFontSize(font, text, field.fontSize ?? 7, field.maxWidth);
  page.drawText(text, {
    color: INK,
    font,
    maxWidth: field.maxWidth,
    size: fontSize,
    x: field.x,
    y: field.y,
  });
}

function drawCenteredText(page: PDFPage, font: PDFFont, value: unknown, field: TextField) {
  const text = standardFontText(font, printable(value));
  if (!text) return;
  const fontSize = fitFontSize(font, text, field.fontSize ?? 7, field.maxWidth);
  const width = font.widthOfTextAtSize(text, fontSize);
  drawText(page, font, text, {
    ...field,
    fontSize,
    x: field.x + Math.max(0, (field.maxWidth - width) / 2),
  });
}

function drawMultiline(
  page: PDFPage,
  font: PDFFont,
  value: unknown,
  field: TextField & { lineHeight?: number; maxLines?: number },
) {
  const text = standardFontText(font, printable(value));
  if (!text) return;
  const fontSize = field.fontSize ?? 7;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= field.maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  for (const [index, textLine] of lines.slice(0, field.maxLines ?? 3).entries()) {
    drawText(page, font, textLine, {
      ...field,
      y: field.y - index * (field.lineHeight ?? fontSize + 2),
    });
  }
}

function drawCheck(page: PDFPage, font: PDFFont, selected: unknown, x: number, y: number) {
  if (selected === true) page.drawText("X", { color: INK, font, size: 8.5, x, y });
}

function drawChoice<T extends string>(
  page: PDFPage,
  font: PDFFont,
  value: T | undefined,
  positions: Partial<Record<T, readonly [number, number]>>,
) {
  if (!value) return;
  const position = positions[value];
  if (position) drawCheck(page, font, true, position[0], position[1]);
}

function drawDate(page: PDFPage, font: PDFFont, value: string | undefined, field: TextField) {
  for (const cell of dateCellLayout(value, field)) {
    drawCenteredText(page, font, cell.text, { ...field, ...cell });
  }
}

function drawTinGroups(
  page: PDFPage,
  font: PDFFont,
  value: string | undefined,
  fields: readonly TextField[],
) {
  const digits = value?.replaceAll(/\D/g, "") ?? "";
  if (digits.length < 9) return;
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)];
  for (const [index, group] of groups.entries()) {
    const field = fields[index];
    if (field && group) drawCenteredText(page, font, group, { ...field, fontSize: 9 });
  }
}

function drawAddress(page: PDFPage, font: PDFFont, address: Address | undefined) {
  if (!address) return;
  drawText(page, font, address.unitRoomFloorBuildingNo, { maxWidth: 82, x: 32, y: 418 });
  drawText(page, font, address.buildingNameTower, { maxWidth: 316, x: 132, y: 418 });
  drawText(page, font, address.lotBlockPhaseHouseNo, { maxWidth: 116, x: 464, y: 418 });
  drawText(page, font, address.streetName, { maxWidth: 284, x: 32, y: 393 });
  drawText(page, font, address.subdivisionVillageZone, { maxWidth: 246, x: 334, y: 393 });
  drawText(page, font, address.barangay, { maxWidth: 284, x: 32, y: 368 });
  drawText(page, font, address.townDistrict, { maxWidth: 246, x: 334, y: 368 });
  drawText(page, font, address.municipalityCity, { maxWidth: 213, x: 32, y: 342 });
  drawText(page, font, address.province, { maxWidth: 258, x: 261, y: 342 });
  drawCenteredText(page, font, address.zipCode, { maxWidth: 43, x: 537, y: 342 });
}

async function signatureImage(pdf: PDFDocument, source: string | undefined) {
  const value = source?.trim() ?? "";
  if (!value) return null;

  let bytes: Uint8Array;
  const dataImage = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (dataImage?.[2]) {
    bytes = Buffer.from(dataImage[2].replaceAll(/\s/g, ""), "base64");
  } else if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 100) {
    bytes = Buffer.from(value.replaceAll(/\s/g, ""), "base64");
  } else {
    throw new Error("Signature image must be an embedded PNG or JPEG");
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

function drawImageInBox(
  page: PDFPage,
  image: PDFImage,
  box: { height: number; width: number; x: number; y: number },
) {
  const natural = image.scale(1);
  const scale = Math.min(box.width / natural.width, box.height / natural.height, 1);
  const width = natural.width * scale;
  const height = natural.height * scale;
  page.drawImage(image, {
    height,
    width,
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
  });
}

async function drawSignature(
  pdf: PDFDocument,
  page: PDFPage,
  source: string | undefined,
  box: { height: number; width: number; x: number; y: number },
) {
  try {
    const image = await signatureImage(pdf, source);
    if (image) drawImageInBox(page, image, box);
  } catch (error) {
    console.warn("BIR form signature image could not be embedded", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function drawPageOne(page: PDFPage, font: PDFFont, bold: PDFFont, data: Bir1905Data) {
  const taxpayer = data.taxpayerInformation;
  drawText(page, font, taxpayer?.dln, { maxWidth: 96, x: 116, y: 881 });
  drawTinGroups(page, bold, taxpayer?.tin, [
    { maxWidth: 43, x: 32, y: 771 },
    { maxWidth: 43, x: 89, y: 771 },
    { maxWidth: 43, x: 146, y: 771 },
    { maxWidth: 73, x: 204, y: 771 },
  ]);
  drawCenteredText(page, bold, taxpayer?.rdoCode, {
    fontSize: 8,
    maxWidth: 44,
    x: 305,
    y: 771,
  });
  drawText(page, font, taxpayer?.contactNumber, { maxWidth: 202, x: 377, y: 771 });
  drawText(page, bold, taxpayer?.registeredName, { fontSize: 8, maxWidth: 546, x: 23, y: 741 });

  const replacement = data.replacementOrCancellation;
  const forms = replacement?.forms;
  drawCheck(page, bold, forms?.certificateOfRegistration, 33, 691);
  drawCheck(page, bold, forms?.authorityToPrint, 33, 673);
  drawCheck(page, bold, forms?.taxClearanceCertificate, 33, 655);
  drawCheck(page, bold, forms?.tinCard, 33, 637);
  drawCheck(page, bold, forms?.other, 33, 619);
  drawText(page, font, forms?.otherDescription, { maxWidth: 94, x: 108, y: 618 });
  const reasons = replacement?.reasons;
  drawCheck(page, bold, reasons?.lostOrDamaged, 223, 691);
  drawCheck(page, bold, reasons?.changeOfAccreditedPrinter, 223, 673);
  drawCheck(page, bold, reasons?.registrationInformationCorrection, 223, 655);
  drawCheck(page, bold, reasons?.other, 223, 637);
  drawMultiline(page, font, reasons?.otherDescription, {
    fontSize: 6.5,
    lineHeight: 8,
    maxLines: 2,
    maxWidth: 172,
    x: 232,
    y: 621,
  });

  const otherUpdates = data.otherUpdates;
  drawCheck(page, bold, otherUpdates?.closureOfBusiness, 425, 691);
  drawCheck(page, bold, otherUpdates?.changeOfCivilStatus, 425, 673);
  drawCheck(page, bold, otherUpdates?.registerOrUpdateBooks, 425, 655);
  drawCheck(page, bold, otherUpdates?.availEightPercentIncomeTaxRate, 425, 637);
  drawCheck(page, bold, otherUpdates?.other, 425, 619);
  drawMultiline(page, font, otherUpdates?.otherDescription, {
    fontSize: 6.5,
    lineHeight: 8,
    maxLines: 2,
    maxWidth: 143,
    x: 434,
    y: 600,
  });

  const updates = data.registrationInformationUpdate;
  const names = updates?.registeredOrTradeName;
  drawCheck(page, bold, names?.selected, 33, 566);
  drawCheck(page, bold, names?.changeRegisteredName, 62, 548);
  drawCheck(page, bold, names?.changeTradeName, 235, 548);
  drawCheck(page, bold, names?.additionalTradeName, 424, 548);
  drawText(page, font, names?.oldName, { maxWidth: 534, x: 62, y: 529 });
  drawText(page, font, names?.newName, { maxWidth: 534, x: 62, y: 512 });

  const address = updates?.registeredAddress;
  drawCheck(page, bold, address?.selected, 33, 491);
  drawCheck(page, bold, address?.transferWithinSameRdo, 62, 462);
  drawCheck(page, bold, address?.transferToAnotherRdo, 235, 462);
  drawCenteredText(page, font, address?.oldRdoCode, { maxWidth: 43, x: 449, y: 462 });
  drawCenteredText(page, font, address?.newRdoCode, { maxWidth: 43, x: 536, y: 462 });
  drawAddress(page, font, address?.newAddress);

  const accounting = updates?.accountingPeriod;
  drawCheck(page, bold, accounting?.selected, 33, 321);
  const accountingRows = [
    { item: accounting?.calendarToFiscal, checkY: 292, valueY: 290 },
    { item: accounting?.fiscalToAnotherFiscal, checkY: 274, valueY: 272 },
    { item: accounting?.fiscalToCalendar, checkY: 256, valueY: 254 },
  ] as const;
  for (const row of accountingRows) {
    drawCheck(page, bold, row.item?.selected, 62, row.checkY);
    drawCenteredText(page, font, row.item?.accountingStartMonth, {
      maxWidth: 115,
      x: 334,
      y: row.valueY,
    });
    drawDate(page, font, row.item?.effectivityDate, {
      maxWidth: 116,
      x: 464,
      y: row.valueY,
    });
  }

  const activity = updates?.registeredActivity;
  drawCheck(page, bold, activity?.selected, 33, 231);
  drawText(page, font, activity?.newActivityOrLineOfBusiness, {
    maxWidth: 420,
    x: 32,
    y: 197,
  });
  drawDate(page, font, activity?.effectivityDate, { maxWidth: 116, x: 464, y: 197 });

  const facilities = updates?.facilityDetails;
  drawCheck(page, bold, facilities?.selected, 33, 169);
  for (const [index, facility] of (facilities?.facilities ?? []).slice(0, 2).entries()) {
    const y = 109 - index * 18;
    drawText(page, font, facilityCodeSuffix(facility.facilityCode), {
      maxWidth: 58,
      x: 74,
      y,
    });
    const types = new Set(facility.facilityTypes ?? []);
    for (const [type, x] of Object.entries({
      placeOfProduction: 134,
      storagePlace: 149,
      warehouse: 164,
      showroom: 179,
      garage: 194,
      busTerminal: 209,
      realPropertyForLease: 224,
      other: 239,
    })) {
      drawCheck(page, bold, types.has(type as never), x, y);
    }
    drawText(page, font, facility.otherFacilityType, { fontSize: 5.5, maxWidth: 57, x: 247, y });
  }
}

function drawPageTwo(page: PDFPage, font: PDFFont, bold: PDFFont, data: Bir1905Data) {
  const updates = data.registrationInformationUpdate;
  const incentive = updates?.incentiveDetails;
  drawCheck(page, bold, incentive?.selected, 33, 865);
  drawText(page, font, incentive?.investmentPromotionAgency, {
    maxWidth: 116,
    x: 175,
    y: 844,
  });
  drawCenteredText(page, font, incentive?.numberOfYears, { maxWidth: 25, x: 464, y: 844 });
  drawText(page, font, incentive?.legalBasis, { maxWidth: 116, x: 175, y: 826 });
  drawDate(page, font, incentive?.startDate, { maxWidth: 116, x: 464, y: 826 });
  drawText(page, font, incentive?.incentivesGranted, { maxWidth: 116, x: 175, y: 808 });
  drawDate(page, font, incentive?.endDate, { maxWidth: 116, x: 464, y: 808 });
  drawText(page, font, incentive?.registrationAccreditationNumber, {
    maxWidth: 116,
    x: 175,
    y: 790,
  });
  drawText(page, font, incentive?.registeredActivity, { maxWidth: 116, x: 464, y: 790 });
  drawDate(page, font, incentive?.effectivityDateFrom, { maxWidth: 115, x: 103, y: 756 });
  drawDate(page, font, incentive?.effectivityDateTo, { maxWidth: 115, x: 233, y: 756 });
  drawText(page, font, incentive?.taxRegime, { maxWidth: 116, x: 464, y: 772 });
  drawDate(page, font, incentive?.dateIssued, { maxWidth: 115, x: 160, y: 738 });
  drawDate(page, font, incentive?.activityStartDate, { maxWidth: 116, x: 464, y: 756 });
  drawDate(page, font, incentive?.activityEndDate, { maxWidth: 116, x: 464, y: 738 });

  const taxes = updates?.taxTypeDetails;
  drawCheck(page, bold, taxes?.selected, 33, 713);
  const taxRows = [
    { row: taxes?.cancelled?.[0], y: 670 },
    { row: taxes?.reRegisteredOrAdded?.[0], y: 627 },
  ] as const;
  for (const { row, y } of taxRows) {
    drawText(page, font, row?.taxType, { maxWidth: 184, x: 33, y });
    drawText(page, font, row?.formType, { maxWidth: 115, x: 232, y });
    drawText(page, font, row?.atc, { maxWidth: 115, x: 348, y });
    drawDate(page, font, row?.effectivityDate, { maxWidth: 116, x: 464, y });
  }
  const suspended = taxes?.suspended?.[0];
  drawText(page, font, suspended?.taxType, { maxWidth: 184, x: 33, y: 582 });
  drawText(page, font, suspended?.formType, { maxWidth: 58, x: 232, y: 582 });
  drawText(page, font, suspended?.atc, { maxWidth: 58, x: 290, y: 582 });
  drawDate(page, font, suspended?.effectivityDateFrom, { maxWidth: 116, x: 348, y: 582 });
  drawDate(page, font, suspended?.effectivityDateTo, { maxWidth: 116, x: 464, y: 582 });

  const contact = updates?.contactType;
  drawCheck(page, bold, contact?.selected, 33, 561);
  const contactTypes = new Set(contact?.contactTypes ?? []);
  drawCheck(page, bold, contactTypes.has("landline"), 48, 545);
  drawCheck(page, bold, contactTypes.has("mobile"), 148, 545);
  drawCheck(page, bold, contactTypes.has("fax"), 248, 545);
  drawText(page, font, contact?.contactNumber, { maxWidth: 143, x: 319, y: 541 });
  drawText(page, font, contact?.email, { maxWidth: 546, x: 32, y: 512 });

  const person = updates?.contactPerson;
  drawCheck(page, bold, person?.selected, 33, 491);
  drawText(page, font, person?.registeredName, { maxWidth: 546, x: 32, y: 460 });
  drawText(page, font, person?.position, { maxWidth: 286, x: 32, y: 431 });
  drawTinGroups(page, font, person?.tin, [
    { maxWidth: 43, x: 334, y: 431 },
    { maxWidth: 43, x: 392, y: 431 },
    { maxWidth: 43, x: 450, y: 431 },
    { maxWidth: 73, x: 508, y: 431 },
  ]);

  const related = updates?.relatedParties;
  drawCheck(page, bold, related?.selected, 33, 408);
  for (const [index, party] of (related?.parties ?? []).slice(0, 5).entries()) {
    const y = 372 - index * 18;
    drawText(page, font, party.registeredName, { maxWidth: 286, x: 32, y });
    drawTinGroups(page, font, party.tin, [
      { maxWidth: 43, x: 334, y },
      { maxWidth: 43, x: 392, y },
      { maxWidth: 43, x: 450, y },
      { maxWidth: 73, x: 508, y },
    ]);
  }

  const cancellation = data.closureOrCancellation?.cancellationOfTin;
  drawCheck(page, bold, cancellation?.selected, 33, 264);
  drawCheck(page, bold, cancellation?.death, 62, 249);
  drawCheck(page, bold, cancellation?.multipleOrIdenticalTin, 62, 231);
  drawCheck(page, bold, cancellation?.permanentClosureOfBranch, 62, 214);
  drawCheck(page, bold, cancellation?.permanentClosureOfNonIndividualOperations, 62, 196);
  drawCheck(page, bold, cancellation?.other, 394, 249);
  drawText(page, font, cancellation?.otherDescription, { maxWidth: 172, x: 405, y: 229 });
  drawDate(page, font, cancellation?.effectivityDate, { maxWidth: 116, x: 435, y: 194 });

  const cessation = data.closureOrCancellation?.cessationOfBusiness;
  drawCheck(page, bold, cessation?.selected, 33, 172);
  drawCheck(page, bold, cessation?.permanentClosureOfIndividualHeadOffice, 62, 156);
  drawCheck(page, bold, cessation?.other, 62, 139);
  drawText(page, font, cessation?.otherDescription, { maxWidth: 217, x: 73, y: 122 });
  drawText(page, font, cessation?.tradeBusinessName, { maxWidth: 172, x: 405, y: 138 });
  drawDate(page, font, cessation?.effectivityDate, { maxWidth: 116, x: 435, y: 104 });
}

function drawPageThree(page: PDFPage, font: PDFFont, bold: PDFFont, data: Bir1905Data) {
  const civil = data.civilStatusChange;
  drawChoice(page, bold, civil?.changeType, {
    singleToMarried: [89, 864],
    marriedToSingle: [264, 864],
  });
  drawText(page, font, civil?.oldOrMaidenName, { maxWidth: 546, x: 32, y: 831 });
  drawText(page, font, civil?.newOrMarriedName, { maxWidth: 546, x: 32, y: 803 });
  drawChoice(page, bold, civil?.spouse?.employmentStatus, {
    unemployed: [62, 769],
    employedLocally: [148, 769],
    employedAbroad: [248, 769],
    businessOrProfession: [349, 769],
  });
  drawText(page, font, civil?.spouse?.name, { maxWidth: 314, x: 32, y: 737 });
  drawTinGroups(page, font, civil?.spouse?.tin, [
    { maxWidth: 43, x: 349, y: 737 },
    { maxWidth: 43, x: 407, y: 737 },
    { maxWidth: 43, x: 465, y: 737 },
    { maxWidth: 58, x: 523, y: 737 },
  ]);
  drawText(page, font, civil?.spouse?.employerName, { maxWidth: 314, x: 32, y: 699 });
  drawTinGroups(page, font, civil?.spouse?.employerTin, [
    { maxWidth: 43, x: 349, y: 699 },
    { maxWidth: 43, x: 407, y: 699 },
    { maxWidth: 43, x: 465, y: 699 },
    { maxWidth: 58, x: 523, y: 699 },
  ]);

  const books = data.booksOfAccounts;
  for (const [index, book] of (books?.books ?? []).slice(0, 6).entries()) {
    const y = 645 - index * 15;
    drawText(page, font, bookTypeLabel(book.type), { maxWidth: 66, x: 22, y });
    drawText(page, font, book.booksToBeRegistered, { maxWidth: 284, x: 91, y });
    drawCenteredText(page, font, book.quantity, { maxWidth: 39, x: 377, y });
    drawCenteredText(page, font, book.volumeFrom, { maxWidth: 85, x: 421, y });
    drawCenteredText(page, font, book.volumeTo, { maxWidth: 85, x: 507, y });
  }
  for (const [index, registration] of (books?.registrations ?? []).slice(0, 6).entries()) {
    const y = 530 - index * 18;
    drawDate(page, font, registration.dateRegistered, { maxWidth: 113, x: 19, y });
    drawText(page, font, registration.permitNumber, { maxWidth: 344, x: 134, y });
    drawDate(page, font, registration.dateIssued, { maxWidth: 113, x: 480, y });
  }

  drawMultiline(page, font, data.otherUpdateOrCorrection?.details, {
    fontSize: 7,
    lineHeight: 16,
    maxLines: 2,
    maxWidth: 546,
    x: 32,
    y: 410,
  });
  drawDate(page, font, data.otherUpdateOrCorrection?.effectivityDate, {
    maxWidth: 116,
    x: 46,
    y: 361,
  });
  drawText(page, bold, data.declaration?.printedName, {
    fontSize: 7,
    maxWidth: 229,
    x: 35,
    y: 253,
  });
  drawText(page, bold, data.declaration?.titlePosition, {
    fontSize: 7,
    maxWidth: 111,
    x: 303,
    y: 253,
  });
  drawMultiline(page, font, data.declaration?.receivingOfficeStampAndDate, {
    fontSize: 6,
    lineHeight: 8,
    maxLines: 3,
    maxWidth: 115,
    x: 466,
    y: 310,
  });
}

function drawPageFour(page: PDFPage, bold: PDFFont, data: Bir1905Data) {
  const requirements = data.documentaryRequirements;
  const checks: Array<[unknown, number, number]> = [
    [requirements?.tinCardIssuance?.photoId, 25, 859],
    [requirements?.tinCardIssuance?.governmentIssuedId, 25, 849],
    [requirements?.tinCardIssuance?.affidavitOfLoss, 25, 821],
    [requirements?.sameRdoAddressChange?.addressDocument, 25, 731],
    [requirements?.sameRdoAddressChange?.temporaryInvoiceUseLetter, 25, 712],
    [requirements?.accountingPeriodChange?.requestLetter, 25, 675],
    [requirements?.accountingPeriodChange?.amendedBylaws, 25, 665],
    [requirements?.accountingPeriodChange?.nonForumShoppingDeclaration, 25, 647],
    [requirements?.accountingPeriodChange?.separateReturnUndertaking, 25, 628],
    [requirements?.civilStatusChange?.marriageContractOrCourtOrder, 25, 602],
    [requirements?.civilStatusChange?.temporaryInvoiceUseLetter, 25, 592],
    [requirements?.registeredNameTradeActivityChange?.amendedRegistrationDocument, 25, 547],
    [requirements?.registeredNameTradeActivityChange?.temporaryInvoiceUseLetter, 25, 499],
    [requirements?.incentiveChange?.promotionAgencyCertificate, 25, 466],
    [requirements?.lostCorOrAtp?.affidavitOfLoss, 25, 428],
    [requirements?.lostCorOrAtp?.looseStampFee, 25, 418],
    [requirements?.manualBooks?.permanentlyBoundBooks, 25, 389],
    [requirements?.looseLeafBooks?.permitToUse, 25, 361],
    [requirements?.looseLeafBooks?.permanentlyBoundBooks, 25, 351],
    [requirements?.looseLeafBooks?.completenessAffidavit, 25, 341],
    [requirements?.computerizedBooks?.acknowledgementOrPermit, 25, 308],
    [requirements?.computerizedBooks?.transmittalAndStorageMedia, 25, 280],
    [requirements?.computerizedBooks?.completenessAffidavit, 25, 243],
    [requirements?.individualTransfer?.birForm1905, 313, 848],
    [requirements?.businessTransferOldRdo?.birForm1905Copies, 313, 803],
    [requirements?.businessTransferOldRdo?.invoiceInventory, 313, 757],
    [requirements?.businessTransferOldRdo?.transferCommitment, 313, 703],
    [requirements?.businessTransferNewRdo?.birForm1905Copies, 313, 656],
    [requirements?.businessTransferNewRdo?.amendedSecDocuments, 313, 642],
    [requirements?.businessTransferNewRdo?.businessPermit, 313, 602],
    [requirements?.businessTransferNewRdo?.unusedInvoices, 313, 562],
    [requirements?.businessTransferNewRdo?.transferCommitmentCopy, 313, 545],
    [requirements?.cancellationDueToDeathOrDuplicateTin?.deathCertificate, 313, 510],
    [requirements?.businessClosure?.endingInventory, 313, 472],
    [requirements?.businessClosure?.unusedInvoicesAndForms, 313, 462],
    [requirements?.businessClosure?.originalBirNoticesPermitsCor, 313, 435],
    [requirements?.fees?.taxClearanceLooseStamp, 313, 390],
    [requirements?.representativeDocuments?.transactingThroughRepresentative, 313, 353],
  ];
  for (const [selected, x, y] of checks) drawCheck(page, bold, selected, x, y);
}

function continuationEntries(data: Bir1905Data) {
  const entries: ContinuationEntry[] = [];
  const updates = data.registrationInformationUpdate;

  for (const [index, facility] of (updates?.facilityDetails?.facilities ?? []).slice(2).entries()) {
    entries.push({
      heading: `Item 7E - Additional facility row ${index + 3}`,
      fields: [
        ["Facility code", facility.facilityCode],
        ["Facility types", facility.facilityTypes?.join(", ")],
        ["Other facility type", facility.otherFacilityType],
      ],
    });
  }

  const taxGroups = [
    {
      heading: "Item 7G - Additional cancelled tax type",
      rows: updates?.taxTypeDetails?.cancelled ?? [],
    },
    {
      heading: "Item 7G - Additional re-registered or added tax type",
      rows: updates?.taxTypeDetails?.reRegisteredOrAdded ?? [],
    },
  ] as const;
  for (const group of taxGroups) {
    for (const [index, row] of group.rows.slice(1).entries()) {
      entries.push({
        heading: `${group.heading} row ${index + 2}`,
        fields: [
          ["Tax type", row.taxType],
          ["Form type", row.formType],
          ["ATC", row.atc],
          ["Effectivity date", normalizedDate(row.effectivityDate)],
        ],
      });
    }
  }

  for (const [index, row] of (updates?.taxTypeDetails?.suspended ?? []).slice(1).entries()) {
    entries.push({
      heading: `Item 7G - Additional suspended tax type row ${index + 2}`,
      fields: [
        ["Tax type", row.taxType],
        ["Form type", row.formType],
        ["ATC", row.atc],
        ["Effectivity date from", normalizedDate(row.effectivityDateFrom)],
        ["Effectivity date to", normalizedDate(row.effectivityDateTo)],
      ],
    });
  }

  for (const [index, party] of (updates?.relatedParties?.parties ?? []).slice(5).entries()) {
    entries.push({
      heading: `Item 7J - Additional related-party row ${index + 6}`,
      fields: [
        ["Registered name", party.registeredName],
        ["TIN", party.tin],
      ],
    });
  }

  for (const [index, book] of (data.booksOfAccounts?.books ?? []).slice(6).entries()) {
    entries.push({
      heading: `Item 10 - Additional books-of-accounts row ${index + 7}`,
      fields: [
        ["Type", bookTypeLabel(book.type)],
        ["Books to be registered", book.booksToBeRegistered],
        ["Quantity", book.quantity],
        ["Volume from", book.volumeFrom],
        ["Volume to", book.volumeTo],
      ],
    });
  }

  for (const [index, registration] of (data.booksOfAccounts?.registrations ?? [])
    .slice(6)
    .entries()) {
    entries.push({
      heading: `Item 10 - Additional registered-book row ${index + 7}`,
      fields: [
        ["Date registered", normalizedDate(registration.dateRegistered)],
        ["Permit number", registration.permitNumber],
        ["Date issued", normalizedDate(registration.dateIssued)],
      ],
    });
  }

  return entries;
}

function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const character of standardFontText(font, text)) {
    const candidate = `${line}${character}`;
    if (line && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function appendContinuationPages(
  pdf: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  data: Bir1905Data,
) {
  const entries = continuationEntries(data);
  if (entries.length === 0) return;

  const { height, width } = pdf.getPage(0).getSize();
  const taxpayer = data.taxpayerInformation;
  let attachmentPage = 0;
  let page = pdf.getPage(0);
  let y = 0;

  function addPage() {
    attachmentPage += 1;
    page = pdf.addPage([width, height]);
    page.drawText("ATTACHMENT TO BIR FORM 1905 (DRAFT)", {
      color: INK,
      font: bold,
      size: 12,
      x: 36,
      y: height - 44,
    });
    page.drawText(`Continuation page ${attachmentPage}`, {
      color: INK,
      font,
      size: 8,
      x: width - 126,
      y: height - 43,
    });
    drawText(page, font, `Registered name: ${printable(taxpayer?.registeredName)}`, {
      fontSize: 8,
      maxWidth: width - 72,
      x: 36,
      y: height - 65,
    });
    drawText(page, font, `TIN: ${printable(taxpayer?.tin)}`, {
      fontSize: 8,
      maxWidth: width - 72,
      x: 36,
      y: height - 79,
    });
    y = height - 108;
  }

  addPage();
  for (const entry of entries) {
    if (y < 82) addPage();
    page.drawText(entry.heading, { color: INK, font: bold, size: 8, x: 36, y });
    y -= 13;

    const details =
      entry.fields
        .map(([label, value]) => [label, printable(value)] as const)
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}: ${value}`)
        .join(" | ") || "No values supplied.";
    for (const line of wrapText(font, details, 7, width - 72)) {
      if (y < 48) addPage();
      page.drawText(line, { color: INK, font, size: 7, x: 36, y });
      y -= 10;
    }
    y -= 8;
  }
}

export async function generateBir1905Pdf(data: Bir1905Data, templatePath: string) {
  const templateBytes = await readFile(templatePath);
  const pdf = await PDFDocument.load(templateBytes);
  if (pdf.getPageCount() !== 4) {
    throw new Error("Expected the four-page October 2025 BIR 1905 template");
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  drawPageOne(pdf.getPage(0), font, bold, data);
  drawPageTwo(pdf.getPage(1), font, bold, data);
  drawPageThree(pdf.getPage(2), font, bold, data);
  drawPageFour(pdf.getPage(3), bold, data);

  await drawSignature(pdf, pdf.getPage(2), data.declaration?.signatureSource, {
    height: 30,
    width: 229,
    x: 35,
    y: 260,
  });
  appendContinuationPages(pdf, font, bold, data);

  pdf.setTitle("BIR Form 1905 - Prefilled Draft");
  pdf.setSubject("Draft registration information update, correction, or cancellation");
  pdf.setProducer("eGovPH Business prototype");
  const outputBytes = await pdf.save();
  return { bytes: outputBytes, pageCount: pdf.getPageCount(), size: outputBytes.byteLength };
}
