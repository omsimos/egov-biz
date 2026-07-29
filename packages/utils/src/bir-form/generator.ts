import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { dateCellLayout } from "./date-cells.js";
import { standardFontText } from "./pdf-text.js";
import type { Bir1901Data } from "./schema.js";

type TextField = {
  fontSize?: number;
  maxWidth: number;
  minFontSize?: number;
  x: number;
  y: number;
};

type Address = NonNullable<
  NonNullable<Bir1901Data["taxpayerInformation"]>["localResidenceAddress"]
>;
type Contact = NonNullable<NonNullable<Bir1901Data["taxpayerInformation"]>["contact"]>;
type TaxTypeRow = NonNullable<
  NonNullable<NonNullable<Bir1901Data["taxTypes"]>["incomeTax"]>["individualIncomeTax"]
>;

const INK = rgb(0.05, 0.12, 0.3);

export const DEFAULT_BIR_1901_TEMPLATE = "public/forms/bir-form-1901.pdf";

export function bir1901TemplatePath() {
  const configured = process.env.BIR_FORM_1901_TEMPLATE_PATH?.trim();
  if (configured) return resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  return join(process.cwd(), "public", "forms", "bir-form-1901.pdf");
}

function printable(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function money(value: number | undefined) {
  return value === undefined ? "" : value.toFixed(2);
}

function fitFontSize(
  font: PDFFont,
  value: string,
  requested: number,
  maxWidth: number,
  minimum = 4.5,
) {
  let size = requested;
  while (size > minimum && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.25;
  return size;
}

function drawText(page: PDFPage, font: PDFFont, value: unknown, field: TextField) {
  const text = standardFontText(font, printable(value));
  if (!text) return;
  const fontSize = fitFontSize(
    font,
    text,
    field.fontSize ?? 7.5,
    field.maxWidth,
    field.minFontSize,
  );
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
  const fontSize = fitFontSize(
    font,
    text,
    field.fontSize ?? 7.5,
    field.maxWidth,
    field.minFontSize,
  );
  const width = font.widthOfTextAtSize(text, fontSize);
  drawText(page, font, text, {
    ...field,
    fontSize,
    x: field.x + Math.max(0, (field.maxWidth - width) / 2),
  });
}

function drawCheck(page: PDFPage, font: PDFFont, selected: unknown, x: number, y: number) {
  if (selected !== true) return;
  page.drawText("X", { color: INK, font, size: 8.5, x, y });
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
    drawCenteredText(page, font, cell.text, {
      fontSize: 7,
      ...field,
      ...cell,
    });
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
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)];
  for (const [index, group] of groups.entries()) {
    const field = fields[index];
    if (field) drawCenteredText(page, font, group, { ...field, fontSize: 9 });
  }
}

function drawAddress(
  page: PDFPage,
  font: PDFFont,
  address: Address | undefined,
  firstRowY: number,
  secondRowY: number,
) {
  if (!address) return;
  drawText(page, font, address.unitRoomFloorBuildingNo, {
    maxWidth: 70,
    x: 32,
    y: firstRowY,
  });
  drawText(page, font, address.buildingNameTower, {
    maxWidth: 100,
    x: 118,
    y: firstRowY,
  });
  drawText(page, font, address.lotBlockPhaseHouseNo, {
    maxWidth: 85,
    x: 233,
    y: firstRowY,
  });
  drawText(page, font, address.streetName, { maxWidth: 116, x: 334, y: firstRowY });
  drawText(page, font, address.subdivisionVillageZone, {
    maxWidth: 111,
    x: 466,
    y: firstRowY,
  });
  drawText(page, font, address.barangay, { maxWidth: 113, x: 32, y: secondRowY });
  drawText(page, font, address.townDistrict, { maxWidth: 100, x: 161, y: secondRowY });
  drawText(page, font, address.municipalityCity, {
    maxWidth: 114,
    x: 276,
    y: secondRowY,
  });
  drawText(page, font, address.province, { maxWidth: 113, x: 408, y: secondRowY });
  drawCenteredText(page, font, address.zipCode, {
    fontSize: 7,
    maxWidth: 40,
    x: 537,
    y: secondRowY,
  });
}

function drawContact(
  page: PDFPage,
  font: PDFFont,
  contact: Contact | undefined,
  checkY: number,
  valueY: number,
) {
  if (!contact) return;
  const preferred = new Set(contact.preferredTypes ?? []);
  drawCheck(page, font, preferred.has("landline"), 33, checkY);
  drawCheck(page, font, preferred.has("fax"), 118, checkY);
  drawCheck(page, font, preferred.has("mobile"), 204, checkY);
  drawText(page, font, contact.landline, { maxWidth: 70, x: 32, y: valueY });
  drawText(page, font, contact.fax, { maxWidth: 70, x: 118, y: valueY });
  drawText(page, font, contact.mobile, { maxWidth: 70, x: 205, y: valueY });
  drawText(page, font, contact.email, { maxWidth: 286, x: 291, y: valueY });
}

function drawTaxTypeRow(
  page: PDFPage,
  font: PDFFont,
  row: TaxTypeRow | undefined,
  y: number,
  side: "left" | "right",
) {
  if (!row) return;
  const checkX = side === "left" ? 20 : 307;
  const formTypeX = side === "left" ? 176 : 466;
  const atcX = side === "left" ? 248 : 538;
  drawCheck(page, font, row.selected, checkX, y + 1);
  drawText(page, font, row.formType, { fontSize: 6.5, maxWidth: 55, x: formTypeX, y });
  drawText(page, font, row.atc, { fontSize: 6.5, maxWidth: 51, x: atcX, y });
}

async function signatureImage(pdf: PDFDocument, source: string | undefined) {
  const value = source?.trim() ?? "";
  if (!value) return null;

  let bytes: Uint8Array;
  const dataImage = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (dataImage?.[1] && dataImage[2]) {
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

function drawPageOne(page: PDFPage, font: PDFFont, bold: PDFFont, data: Bir1901Data) {
  const registration = data.registration;
  const taxpayer = data.taxpayerInformation;
  const taxpayerName = taxpayer?.taxpayerName;

  drawText(page, font, registration?.dln, { maxWidth: 112, x: 116, y: 908 });
  drawCenteredText(page, bold, registration?.tinToBeIssued, {
    fontSize: 9,
    maxWidth: 245,
    x: 347,
    y: 840,
  });
  drawChoice(page, bold, registration?.registeringOffice, {
    headOffice: [32, 784],
    branchOffice: [104, 784],
    facility: [176, 784],
  });
  drawDate(page, font, registration?.birRegistrationDate, {
    maxWidth: 116,
    x: 248,
    y: 786,
  });
  drawCenteredText(page, bold, registration?.philsysCardNumber, {
    fontSize: 8.5,
    maxWidth: 184,
    x: 391,
    y: 786,
  });

  drawTinGroups(page, bold, taxpayer?.tin, [
    { maxWidth: 43, x: 219, y: 753 },
    { maxWidth: 43, x: 276, y: 753 },
    { maxWidth: 43, x: 333, y: 753 },
  ]);
  drawCenteredText(page, font, taxpayer?.rdoCode, { maxWidth: 28, x: 553, y: 753 });

  drawChoice(page, bold, taxpayer?.taxpayerType, {
    singleProprietorshipResidentCitizen: [32, 724],
    singleProprietorDigitalServiceProvider: [32, 709],
    residentAlienSingleProprietorship: [32, 694],
    residentAlienProfessional: [32, 679],
    professionalLicensed: [32, 664],
    professionalGeneral: [32, 649],
    professionalAndSingleProprietor: [32, 634],
    mixedIncomeCompensationAndSingleProprietor: [32, 619],
    mixedIncomeCompensationAndProfessional: [291, 724],
    mixedIncomeCompensationSingleProprietorAndProfessional: [291, 709],
    nonResidentAlienTradeBusiness: [291, 694],
    estateFilipinoCitizen: [291, 679],
    estateForeignNational: [291, 664],
    trustFilipinoCitizen: [291, 649],
    trustForeignNational: [291, 634],
  });

  drawText(page, bold, taxpayerName?.lastName, { maxWidth: 139, x: 32, y: 588 });
  drawText(page, bold, taxpayerName?.firstName, { maxWidth: 139, x: 192, y: 588 });
  drawText(page, bold, taxpayerName?.middleName, { maxWidth: 130, x: 349, y: 588 });
  drawText(page, bold, taxpayerName?.suffix, { fontSize: 7, maxWidth: 27, x: 495, y: 588 });
  drawText(page, bold, taxpayerName?.nickname, { fontSize: 7, maxWidth: 42, x: 537, y: 588 });
  drawText(page, font, taxpayer?.estateOrTrustName, { maxWidth: 540, x: 32, y: 570 });

  drawChoice(page, bold, taxpayer?.gender, {
    male: [76, 545.5],
    female: [134, 545.5],
  });
  drawChoice(page, bold, taxpayer?.civilStatus, {
    single: [264, 545.5],
    married: [335, 545.5],
    widowed: [409, 545.5],
    legallySeparated: [482, 545.5],
  });
  drawDate(page, font, taxpayer?.birthOrOrganizationDate, {
    maxWidth: 108,
    x: 231,
    y: 527,
  });
  drawText(page, font, taxpayer?.placeOfBirth, { maxWidth: 125, x: 467, y: 527 });
  drawText(page, font, taxpayer?.motherMaidenName, { maxWidth: 170, x: 133, y: 510 });
  drawText(page, font, taxpayer?.fatherName, { maxWidth: 184, x: 409, y: 510 });
  drawText(page, font, taxpayer?.citizenship, { maxWidth: 168, x: 133, y: 497 });
  drawText(page, font, taxpayer?.otherCitizenship, { maxWidth: 184, x: 409, y: 497 });

  drawAddress(page, font, taxpayer?.localResidenceAddress, 460.5, 436);
  drawAddress(page, font, taxpayer?.businessAddress, 400.5, 376);
  drawText(page, font, taxpayer?.foreignAddress, { maxWidth: 486, x: 105, y: 358.5 });
  drawText(page, font, taxpayer?.municipalityCode, { maxWidth: 70, x: 118, y: 342 });
  drawText(page, font, taxpayer?.purposeOfTinApplication, {
    maxWidth: 260,
    x: 320,
    y: 342,
  });

  const identification = taxpayer?.identification;
  drawText(page, font, identification?.type, { maxWidth: 56, x: 32, y: 304.5 });
  drawText(page, font, identification?.idNumber, { maxWidth: 73, x: 102, y: 304.5 });
  drawDate(page, font, identification?.effectivityDate, {
    fontSize: 6.5,
    maxWidth: 114,
    x: 190,
    y: 304.5,
  });
  drawDate(page, font, identification?.expiryDate, {
    fontSize: 6.5,
    maxWidth: 117,
    x: 319,
    y: 304.5,
  });
  drawText(page, font, identification?.issuer, {
    fontSize: 6,
    maxWidth: 49,
    minFontSize: 3,
    x: 452,
    y: 304.5,
  });
  drawText(page, font, identification?.placeCountryOfIssue, {
    fontSize: 6,
    maxWidth: 55,
    minFontSize: 2.75,
    x: 523,
    y: 304.5,
  });
  drawContact(page, font, taxpayer?.contact, 282.5, 266);

  drawChoice(page, bold, taxpayer?.eightPercentIncomeTaxRate, {
    yes: [438, 244],
    no: [496, 244],
  });
  drawChoice(page, bold, data.taxpayerClassification?.expectedAnnualGrossSales, {
    micro: [33, 210],
    small: [33, 195],
    medium: [306, 210],
    large: [306, 195],
  });

  const spouse = data.spouseInformation;
  drawChoice(page, bold, spouse?.employmentStatus, {
    unemployed: [178, 169],
    employedLocally: [264, 169],
    employedAbroad: [350, 169],
    businessOrProfession: [439, 169],
  });
  drawText(page, font, spouse?.name, { maxWidth: 320, x: 32, y: 147 });
  drawTinGroups(page, bold, spouse?.tin, [
    { maxWidth: 42, x: 362, y: 139 },
    { maxWidth: 42, x: 420, y: 139 },
    { maxWidth: 42, x: 478, y: 139 },
  ]);
  drawText(page, font, spouse?.employerName, { maxWidth: 320, x: 32, y: 111 });
  drawTinGroups(page, bold, spouse?.employerTin, [
    { maxWidth: 42, x: 362, y: 102 },
    { maxWidth: 42, x: 420, y: 102 },
    { maxWidth: 42, x: 478, y: 102 },
  ]);

  const representative = data.authorizedRepresentative;
  drawText(page, font, representative?.individualName?.lastName, {
    maxWidth: 139,
    x: 32,
    y: 52,
  });
  drawText(page, font, representative?.individualName?.firstName, {
    maxWidth: 139,
    x: 192,
    y: 52,
  });
  drawText(page, font, representative?.individualName?.middleName, {
    maxWidth: 130,
    x: 349,
    y: 52,
  });
  drawText(page, font, representative?.individualName?.suffix, {
    fontSize: 6,
    maxWidth: 27,
    x: 495,
    y: 52,
  });
  drawText(page, font, representative?.individualName?.nickname, {
    fontSize: 6,
    maxWidth: 42,
    x: 537,
    y: 52,
  });
  drawText(page, font, representative?.nonIndividualRegisteredName, {
    maxWidth: 405,
    x: 177,
    y: 34,
  });
}

function drawPageTwo(page: PDFPage, font: PDFFont, bold: PDFFont, data: Bir1901Data) {
  const representative = data.authorizedRepresentative;
  drawDate(page, font, representative?.relationshipDate, {
    maxWidth: 112,
    x: 49,
    y: 870,
  });
  drawChoice(page, bold, representative?.addressType, {
    residence: [205, 869],
    placeOfBusiness: [291, 869],
    employerAddress: [424, 869],
  });
  drawAddress(page, font, representative?.address, 834, 809);
  drawContact(page, font, representative?.contact, 783, 769);

  const business = data.businessInformation;
  drawText(page, bold, business?.singleBusinessNumber, {
    maxWidth: 140,
    x: 263,
    y: 741,
  });
  const primary = business?.primaryIndustry;
  const secondary = business?.secondaryIndustry;
  drawText(page, font, primary?.industry, { maxWidth: 95, x: 75, y: 703 });
  drawText(page, font, primary?.tradeBusinessName, { maxWidth: 320, x: 171, y: 703 });
  drawText(page, font, primary?.regulatoryBody, { maxWidth: 95, x: 493, y: 703 });
  drawText(page, font, secondary?.industry, { maxWidth: 95, x: 75, y: 688 });
  drawText(page, font, secondary?.tradeBusinessName, { maxWidth: 320, x: 171, y: 688 });
  drawText(page, font, secondary?.regulatoryBody, { maxWidth: 95, x: 493, y: 688 });
  drawText(page, font, primary?.businessRegistrationNumber, {
    maxWidth: 95,
    x: 75,
    y: 650,
  });
  drawDate(page, font, primary?.businessRegistrationDate, {
    maxWidth: 108,
    x: 187,
    y: 650,
  });
  drawText(page, font, primary?.psicCode, { maxWidth: 95, x: 299, y: 650 });
  drawText(page, font, primary?.lineOfBusiness, { maxWidth: 184, x: 405, y: 650 });
  drawText(page, font, secondary?.businessRegistrationNumber, {
    maxWidth: 95,
    x: 75,
    y: 634,
  });
  drawDate(page, font, secondary?.businessRegistrationDate, {
    maxWidth: 108,
    x: 187,
    y: 634,
  });
  drawText(page, font, secondary?.psicCode, { maxWidth: 95, x: 299, y: 634 });
  drawText(page, font, secondary?.lineOfBusiness, { maxWidth: 184, x: 405, y: 634 });

  const incentives = business?.incentives;
  drawText(page, font, incentives?.investmentPromotion, { maxWidth: 155, x: 32, y: 597 });
  drawText(page, font, incentives?.legalBasis, { maxWidth: 130, x: 205, y: 597 });
  drawText(page, font, incentives?.incentiveGranted, { maxWidth: 200, x: 376, y: 597 });
  drawCenteredText(page, font, incentives?.numberOfYears, {
    maxWidth: 58,
    x: 103,
    y: 579,
  });
  drawDate(page, font, incentives?.startDate, { maxWidth: 103, x: 263, y: 579 });
  drawDate(page, font, incentives?.endDate, { maxWidth: 103, x: 479, y: 579 });

  const accreditation = business?.registrationAccreditation;
  drawText(page, font, accreditation?.number, { maxWidth: 112, x: 32, y: 542 });
  drawDate(page, font, accreditation?.effectivityDateFrom, {
    maxWidth: 111,
    x: 190,
    y: 542,
  });
  drawDate(page, font, accreditation?.effectivityDateTo, {
    maxWidth: 111,
    x: 319,
    y: 542,
  });
  drawDate(page, font, accreditation?.dateIssued, {
    maxWidth: 111,
    x: 467,
    y: 542,
  });
  drawText(page, font, accreditation?.registeredActivity, {
    maxWidth: 112,
    x: 32,
    y: 515,
  });
  drawText(page, font, accreditation?.taxRegime, { maxWidth: 112, x: 176, y: 515 });
  drawDate(page, font, accreditation?.activityStartDate, {
    maxWidth: 111,
    x: 319,
    y: 515,
  });
  drawDate(page, font, accreditation?.activityEndDate, {
    maxWidth: 111,
    x: 467,
    y: 515,
  });

  const facility = data.facilityDetails;
  drawText(page, bold, facility?.facilityCode?.replace(/^F[- ]?/i, ""), {
    maxWidth: 88,
    x: 55,
    y: 464,
  });
  drawChoice(page, bold, facility?.facilityType, {
    placeOfProduction: [162, 464],
    storagePlace: [205, 464],
    warehouse: [249, 464],
    showroom: [291, 464],
    garage: [335, 464],
    busTerminal: [379, 464],
    realPropertyForLease: [422, 464],
    other: [465, 464],
  });
  drawText(page, font, facility?.otherFacilityType, { maxWidth: 53, x: 535, y: 464 });
  drawAddress(page, font, facility?.address, 427, 402);

  const taxes = data.taxTypes;
  const leftRows: Array<[TaxTypeRow | undefined, number]> = [
    [taxes?.incomeTax?.individualIncomeTax, 343],
    [taxes?.incomeTax?.capitalGainsRealProperty, 329],
    [taxes?.incomeTax?.capitalGainsStocks, 316],
    [taxes?.withholdingTax?.compensation, 289],
    [taxes?.withholdingTax?.expanded, 276],
    [taxes?.withholdingTax?.final, 262],
    [taxes?.withholdingTax?.fringeBenefits, 248],
    [taxes?.withholdingTax?.valueAddedTax, 235],
    [taxes?.withholdingTax?.otherPercentageTax, 221],
    [taxes?.withholdingTax?.onettNotSubjectToCgt, 207],
    [taxes?.withholdingTax?.winningsAndPrizes, 194],
    [taxes?.withholdingTax?.interestOnDepositsAndYield, 176],
    [taxes?.percentageTax?.stocks, 149],
    [taxes?.percentageTax?.stocksInitialPublicOffering, 136],
    [taxes?.percentageTax?.overseasDispatchAndAmusement, 122],
    [taxes?.percentageTax?.underSpecialLaws, 108],
  ];
  for (const [row, y] of leftRows) drawTaxTypeRow(page, font, row, y, "left");
  const otherPercentageTaxes = taxes?.percentageTax?.otherPercentageTaxesUnderNirc;
  drawCheck(page, font, otherPercentageTaxes?.selected, 20, 95);
  drawText(page, font, otherPercentageTaxes?.description, {
    fontSize: 6,
    maxWidth: 126,
    x: 32,
    y: 80,
  });
  drawText(page, font, otherPercentageTaxes?.formType, {
    fontSize: 6.5,
    maxWidth: 55,
    x: 176,
    y: 80,
  });
  drawText(page, font, otherPercentageTaxes?.atc, {
    fontSize: 6.5,
    maxWidth: 51,
    x: 248,
    y: 80,
  });

  const rightRows: Array<[TaxTypeRow | undefined, number]> = [
    [taxes?.valueAddedTax, 358],
    [taxes?.exciseTax?.alcoholProducts, 329],
    [taxes?.exciseTax?.automobileAndNonEssentialGoods, 316],
    [taxes?.exciseTax?.cosmeticProcedures, 302],
    [taxes?.exciseTax?.mineralProducts, 289],
    [taxes?.exciseTax?.petroleumProducts, 275],
    [taxes?.exciseTax?.sweetenedBeverages, 262],
    [taxes?.exciseTax?.tobaccoProducts, 248],
    [taxes?.exciseTax?.tobaccoInspectionMonitoringFees, 235],
    [taxes?.exciseTax?.vaporProducts, 221],
    [taxes?.documentaryStampTax?.regular, 191],
    [taxes?.documentaryStampTax?.onett, 174],
    [taxes?.transferTax?.donorsTax, 149],
    [taxes?.transferTax?.estateTax, 135],
  ];
  for (const [row, y] of rightRows) drawTaxTypeRow(page, font, row, y, "right");
  drawText(page, font, taxes?.miscellaneousTax?.description, {
    fontSize: 6,
    maxWidth: 126,
    x: 320,
    y: 101,
  });
  drawText(page, font, taxes?.miscellaneousTax?.formType, {
    fontSize: 6.5,
    maxWidth: 55,
    x: 466,
    y: 101,
  });
  drawText(page, font, taxes?.miscellaneousTax?.atc, {
    fontSize: 6.5,
    maxWidth: 51,
    x: 538,
    y: 101,
  });
  drawText(page, font, taxes?.others?.description, {
    fontSize: 6,
    maxWidth: 126,
    x: 320,
    y: 80,
  });
  drawText(page, font, taxes?.others?.formType, {
    fontSize: 6.5,
    maxWidth: 55,
    x: 466,
    y: 80,
  });
  drawText(page, font, taxes?.others?.atc, {
    fontSize: 6.5,
    maxWidth: 51,
    x: 538,
    y: 80,
  });
}

function drawPageThree(page: PDFPage, font: PDFFont, bold: PDFFont, data: Bir1901Data) {
  const printed = data.invoices?.birPrintedInvoices;
  drawChoice(page, bold, printed?.intendsToUse, {
    yes: [61, 834],
    no: [133, 834],
  });
  drawChoice(page, bold, printed?.type, {
    vat: [278, 834],
    nonVat: [322, 834],
  });
  drawCenteredText(page, font, printed?.numberOfBooklets, {
    maxWidth: 58,
    x: 392,
    y: 834,
  });
  drawText(page, font, printed?.serialNumberStart, { maxWidth: 43, x: 480, y: 834 });
  drawText(page, font, printed?.serialNumberEnd, { maxWidth: 43, x: 537, y: 834 });

  const authority = data.invoices?.authorityToPrint;
  drawText(page, font, authority?.printerName, { maxWidth: 465, x: 119, y: 808 });
  drawTinGroups(page, bold, authority?.printerTin, [
    { maxWidth: 43, x: 32, y: 780 },
    { maxWidth: 43, x: 90, y: 780 },
    { maxWidth: 43, x: 147, y: 780 },
  ]);
  drawText(page, font, authority?.printerAccreditationNumber, {
    maxWidth: 130,
    x: 277,
    y: 780,
  });
  drawDate(page, font, authority?.accreditationDate, {
    maxWidth: 111,
    x: 451,
    y: 780,
  });
  drawAddress(page, font, authority?.registeredAddress, 743, 718);
  drawText(page, font, authority?.contactNumber, { maxWidth: 150, x: 32, y: 692 });
  drawText(page, font, authority?.email, { maxWidth: 360, x: 192, y: 692 });
  drawChoice(page, bold, authority?.manner, {
    bound: [236, 675],
    looseLeaf: [323, 675],
  });

  for (const [index, row] of (authority?.descriptions ?? []).entries()) {
    const y = 615 - index * 16.5;
    drawText(page, font, row.description, { fontSize: 6.5, maxWidth: 240, x: 32, y });
    drawChoice(page, bold, row.type, {
      vat: [269, y],
      nonVat: [299, y],
    });
    drawCenteredText(page, font, row.looseBoxesBooklets, {
      fontSize: 6,
      maxWidth: 27,
      x: 320,
      y,
    });
    drawCenteredText(page, font, row.boundBoxesBooklets, {
      fontSize: 6,
      maxWidth: 27,
      x: 349,
      y,
    });
    drawCenteredText(page, font, row.setsPerBoxBooklet, {
      fontSize: 6,
      maxWidth: 41,
      x: 378,
      y,
    });
    drawText(page, font, row.serialNumberStart, { fontSize: 6, maxWidth: 50, x: 422, y });
    drawText(page, font, row.serialNumberEnd, { fontSize: 6, maxWidth: 50, x: 494, y });
    drawCenteredText(page, font, row.copiesPerSet, {
      fontSize: 6,
      maxWidth: 35,
      x: 554,
      y,
    });
  }

  const employments = data.multipleEmployments;
  drawChoice(page, bold, employments?.type, {
    successive: [177, 535],
    concurrent: [393, 535],
  });
  for (const [index, employer] of (employments?.employers ?? []).entries()) {
    const y = 492 - index * 33;
    drawText(page, font, employer.name, { maxWidth: 310, x: 32, y });
    drawCheck(page, bold, employer.primaryEmployer, 161, y + 17);
    drawTinGroups(page, bold, employer.tin, [
      { maxWidth: 42, x: 362, y },
      { maxWidth: 42, x: 420, y },
      { maxWidth: 42, x: 478, y },
    ]);
  }
  const currentEmployer = employments?.primaryCurrentEmployer;
  drawDate(page, font, currentEmployer?.relationshipStartDate, {
    maxWidth: 110,
    x: 32,
    y: 404,
  });
  const currentEmployerContact = currentEmployer?.contact;
  const preferredContactTypes = new Set(currentEmployerContact?.preferredTypes ?? []);
  drawCheck(page, bold, preferredContactTypes.has("landline"), 147, 424);
  drawCheck(page, bold, preferredContactTypes.has("fax"), 234, 424);
  drawCheck(page, bold, preferredContactTypes.has("mobile"), 320, 424);
  drawText(page, font, currentEmployerContact?.landline, { maxWidth: 70, x: 147, y: 404 });
  drawText(page, font, currentEmployerContact?.fax, { maxWidth: 70, x: 234, y: 404 });
  drawText(page, font, currentEmployerContact?.mobile, { maxWidth: 70, x: 320, y: 404 });
  drawText(page, font, currentEmployerContact?.email, { maxWidth: 174, x: 406, y: 404 });

  drawText(page, bold, data.declaration?.printedName, {
    fontSize: 7,
    maxWidth: 130,
    x: 176,
    y: 326,
  });
  drawText(page, font, data.declaration?.receivingOfficeAndDateOfReceipt, {
    fontSize: 6,
    maxWidth: 120,
    x: 466,
    y: 333,
  });

  const payment = data.paymentOrder;
  drawTinGroups(page, bold, payment?.taxpayerTin, [
    { maxWidth: 42, x: 133, y: 187 },
    { maxWidth: 42, x: 191, y: 187 },
    { maxWidth: 42, x: 248, y: 187 },
  ]);
  drawCenteredText(page, bold, payment?.branchCode, {
    fontSize: 8,
    maxWidth: 61,
    x: 306,
    y: 187,
  });
  drawCenteredText(page, bold, payment?.rdoCode, {
    fontSize: 8,
    maxWidth: 44,
    x: 407,
    y: 187,
  });
  drawCenteredText(page, bold, payment?.year, {
    fontSize: 8,
    maxWidth: 50,
    x: 510,
    y: 187,
  });
  drawText(page, bold, payment?.taxpayerName, {
    fontSize: 8,
    maxWidth: 430,
    x: 134,
    y: 161,
  });
  drawDate(page, font, payment?.paymentDate, { maxWidth: 110, x: 190, y: 130 });
  drawText(page, font, payment?.erorRorNumber, { maxWidth: 110, x: 52, y: 104 });
  drawText(page, font, money(payment?.amountForBirPrintedInvoices), {
    maxWidth: 100,
    x: 480,
    y: 104,
  });
  drawText(page, font, money(payment?.surcharge), { maxWidth: 100, x: 176, y: 77 });
  drawText(page, font, money(payment?.interest), { maxWidth: 100, x: 277, y: 77 });
  drawText(page, font, money(payment?.compromise), { maxWidth: 100, x: 378, y: 77 });
  drawText(page, font, money(payment?.totalPenalties), { maxWidth: 100, x: 480, y: 77 });
  drawText(page, bold, money(payment?.totalAmountPayable), {
    maxWidth: 100,
    x: 480,
    y: 59,
  });
}

function drawPageFour(page: PDFPage, font: PDFFont, bold: PDFFont, data: Bir1901Data) {
  const requirements = data.documentaryRequirements;
  const self = requirements?.selfEmployed;
  const estate = requirements?.estateAndTrust;
  const branch = requirements?.branchAndFacility;

  drawCheck(page, bold, self?.governmentIssuedId, 25, 847);
  drawCheck(page, bold, self?.invoiceRequirement, 25, 737);
  drawCheck(page, bold, self?.birPrintedInvoice, 53, 737);
  drawCheck(page, bold, self?.ownInvoices, 53, 719);
  drawCheck(page, bold, self?.looseDocumentaryStampTax, 25, 655);
  drawCheck(page, bold, self?.representativeSpa, 25, 573);
  drawCheck(page, bold, self?.dtiCertificate, 25, 508);
  drawCheck(page, bold, self?.workVisa, 25, 497);
  drawCheck(page, bold, self?.serviceContract, 25, 486);
  drawCheck(page, bold, self?.franchiseDocuments, 25, 470);
  drawCheck(page, bold, self?.bmbeCertificateOfAuthority, 25, 452);
  drawCheck(page, bold, self?.investmentPromotionRegistrationPermit, 25, 433);

  drawCheck(page, bold, estate?.deathCertificate, 318, 857);
  drawCheck(page, bold, estate?.irrevocableTrustAgreement, 318, 838);
  drawCheck(page, bold, estate?.representativeSpa, 318, 810);
  drawCheck(page, bold, estate?.administratorExecutorHeirProof, 318, 737);

  drawCheck(page, bold, branch?.branchAddressDocument, 318, 664);
  drawCheck(page, bold, branch?.branchInvoiceRequirement, 318, 636);
  drawCheck(page, bold, branch?.branchBirPrintedInvoice, 347, 636);
  drawCheck(page, bold, branch?.branchOwnInvoices, 347, 617);
  drawCheck(page, bold, branch?.facilityAddressDocument, 318, 553);
  drawCheck(page, bold, branch?.looseDocumentaryStampTax, 318, 508);
  drawCheck(page, bold, branch?.representativeSpa, 318, 461);
  drawCheck(page, bold, branch?.dtiCertificate, 318, 396);
  drawCheck(page, bold, branch?.franchiseDocuments, 318, 387);
  drawCheck(page, bold, branch?.franchiseAgreement, 318, 368);
  drawCheck(page, bold, branch?.bmbeCertificateOfAuthority, 318, 359);
  drawCheck(page, bold, branch?.investmentPromotionRegistrationPermit, 318, 341);

  const declaration = data.voluntaryPaymentDeclaration;
  drawText(page, bold, declaration?.printedName, {
    fontSize: 7,
    maxWidth: 205,
    x: 55,
    y: 97,
  });
  drawText(page, bold, declaration?.titlePosition, {
    fontSize: 7,
    maxWidth: 100,
    x: 308,
    y: 97,
  });
  drawText(page, font, declaration?.receivingOfficeStampAndDate, {
    fontSize: 6,
    maxWidth: 120,
    x: 466,
    y: 205,
  });
}

export async function generateBir1901Pdf(data: Bir1901Data, templatePath: string) {
  const templateBytes = await readFile(templatePath);
  const pdf = await PDFDocument.load(templateBytes);
  if (pdf.getPageCount() !== 4)
    throw new Error("Expected the four-page October 2025 BIR 1901 template");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  drawPageOne(pdf.getPage(0), font, fontBold, data);
  drawPageTwo(pdf.getPage(1), font, fontBold, data);
  drawPageThree(pdf.getPage(2), font, fontBold, data);
  drawPageFour(pdf.getPage(3), font, fontBold, data);

  await drawSignature(pdf, pdf.getPage(2), data.declaration?.signatureSource, {
    height: 34,
    width: 125,
    x: 180,
    y: 313,
  });
  await drawSignature(pdf, pdf.getPage(3), data.voluntaryPaymentDeclaration?.signatureSource, {
    height: 34,
    width: 205,
    x: 55,
    y: 105,
  });

  pdf.setTitle("BIR Form 1901 - Prefilled Draft");
  pdf.setSubject("Draft prefilled from authenticated and explicitly supplied form data");
  pdf.setProducer("eGovPH Business prototype");
  const outputBytes = await pdf.save();
  return { bytes: outputBytes, pageCount: pdf.getPageCount(), size: outputBytes.byteLength };
}

export async function writeBir1901Pdf(data: Bir1901Data, templatePath: string, outputPath: string) {
  const result = await generateBir1901Pdf(data, templatePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.bytes);
  return { outputPath, pageCount: result.pageCount, size: result.size };
}
