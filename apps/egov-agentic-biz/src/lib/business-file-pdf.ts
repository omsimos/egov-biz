import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BusinessFile, RegisteredBusiness } from "@/lib/registered-business";

function wrap(text: string, width = 72) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateDemoBusinessFilePdf(
  business: RegisteredBusiness,
  file: BusinessFile,
+) {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 720, width: 612, height: 72, color: rgb(0.06, 0.22, 0.5) });
  page.drawText("DEMO ONLY — NOT AN OFFICIAL GOVERNMENT DOCUMENT", {
    x: 42,
    y: 750,
    size: 13,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(file.title, { x: 42, y: 676, size: 22, font: bold, color: rgb(0.08, 0.12, 0.2) });
  page.drawText(file.documentType, {
    x: 42,
    y: 650,
    size: 11,
    font: regular,
    color: rgb(0.25, 0.34, 0.45),
  });

  const rows = [
    ["Taxpayer / owner", business.ownerName],
    ["Registration type", business.type],
    ["Registration reference", business.registrationNumber],
    ["Business activity", business.businessActivity],
    ["Business city", business.city],
    ["RDO", business.rdo || "For BIR confirmation"],
    ["TIN", business.tinMasked || "Masked in this demo"],
    ["Generated", new Date(file.createdAt).toLocaleDateString("en-PH")],
  ];
  let y = 602;
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), {
      x: 42,
      y,
      size: 8,
      font: bold,
      color: rgb(0.25, 0.34, 0.45),
    });
    page.drawText(value, { x: 190, y: y - 1, size: 10, font: regular, color: rgb(0.08, 0.12, 0.2) });
    page.drawLine({
      start: { x: 42, y: y - 12 },
      end: { x: 570, y: y - 12 },
      thickness: 0.6,
      color: rgb(0.86, 0.89, 0.93),
    });
    y -= 42;
  }

  y -= 8;
  for (const line of wrap(file.note)) {
    page.drawText(line, { x: 42, y, size: 10, font: regular, color: rgb(0.25, 0.34, 0.45) });
    y -= 15;
  }
  page.drawRectangle({
    x: 42,
    y: 52,
    width: 528,
    height: 54,
    borderColor: rgb(0.84, 0.28, 0.24),
    borderWidth: 1,
    color: rgb(1, 0.96, 0.95),
  });
  page.drawText("This file is generated for an eGovPH business demo.", {
    x: 58,
    y: 82,
    size: 10,
    font: bold,
    color: rgb(0.68, 0.16, 0.13),
  });
  page.drawText("It is not Form 2303 or any certificate issued by the Bureau of Internal Revenue.", {
    x: 58,
    y: 65,
    size: 9,
    font: regular,
    color: rgb(0.68, 0.16, 0.13),
  });
  return document.save();
}
