import type { BusinessFile, RegisteredBusiness } from "@/lib/registered-business";
import {
  escapeHtml,
  escapeHtmlWithBreaks,
  renderJsonFormHtml,
  type JsonFormCell,
  type JsonFormNode,
  type JsonFormRow,
} from "./json-to-html";

export type Bir2303TaxItem = {
  category: "EXPANDED/OTHERS" | "WITHHOLDING TAX - FINAL";
  code: string;
  effectiveDate: string;
  frequency: string;
  dueDate: string;
};

export type Bir2303Input = {
  ocn: string;
  dateOcnGenerated: string;
  tin: string;
  branchCode: string;
  taxpayerName: string;
  tinIssuanceDate: string;
  registeredOffice: string;
  registeredAddress: string;
  taxpayerType: string;
  businessName: string;
  category: string;
  registrationDate: string;
  revenueRegion: string;
  revenueDistrictOffice: string;
  activities: Array<{
    psic: string;
    lineOfBusiness: string;
    category: string;
  }>;
  taxItems: Bir2303TaxItem[];
  reminders: string[];
};

const certificateStyle = `
  @page { size: A4; margin: 8mm 10mm; }
  :root {
    --ink: #1b1b1b;
    --line: #4a4a4a;
    color: var(--ink);
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 7mm 10mm 8mm;
    font-size: 9.2px;
    line-height: 1.16;
    color: var(--ink);
    background-color: #f3fafa;
    background-image:
      radial-gradient(circle at 12% 18%, rgba(28,130,128,.05) 0 1px, transparent 1.4px),
      radial-gradient(circle at 78% 42%, rgba(28,130,128,.04) 0 1px, transparent 1.4px),
      repeating-linear-gradient(0deg, rgba(20,128,126,.075) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(90deg, rgba(20,128,126,.06) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(45deg, rgba(20,128,126,.028) 0 1px, transparent 1px 7px),
      repeating-linear-gradient(-45deg, rgba(20,128,126,.02) 0 1px, transparent 1px 7px);
  }
  .certificate {
    position: relative;
    min-height: 275mm;
  }
  .certificate::before {
    content: "";
    position: absolute;
    z-index: 0;
    top: 9mm;
    left: 50%;
    transform: translateX(-50%);
    width: 32mm;
    height: 32mm;
    border-radius: 50%;
    border: 1.5px solid rgba(28, 100, 98, 0.07);
    box-shadow: inset 0 0 0 5px rgba(28, 100, 98, 0.03);
    background:
      radial-gradient(circle at center, transparent 37%, rgba(28,128,126,.035) 38% 40%, transparent 41%),
      conic-gradient(from 0deg, rgba(28,128,126,.028), transparent 22%, rgba(28,128,126,.028) 42%, transparent 62%, rgba(28,128,126,.028) 82%, transparent);
    pointer-events: none;
  }
  .top, .title, .section-label, table { position: relative; z-index: 1; }
  .top {
    display: grid;
    grid-template-columns: 29mm 1fr 56mm;
    column-gap: 6px;
    align-items: start;
    min-height: 34mm;
    margin-bottom: 2mm;
  }
  .form-number {
    font-size: 31px;
    font-weight: 700;
    line-height: 0.9;
    letter-spacing: 0.4px;
  }
  .revision {
    margin-top: 5px;
    font-size: 8.4px;
    font-weight: 700;
  }
  .republic {
    text-align: center;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.16;
    padding-top: 1px;
  }
  .republic .agency { font-size: 8.6px; }
  .republic .office {
    font-size: 8.1px;
    font-weight: 700;
  }
  .seal {
    width: 42px;
    height: 42px;
    margin: 3px auto 2px;
    display: block;
    object-fit: contain;
  }
  .meta {
    padding-top: 8mm;
    font-size: 8.5px;
    line-height: 1.42;
    text-align: right;
  }
  .meta .row {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    white-space: nowrap;
  }
  .meta .label {
    font-weight: 700;
    min-width: 31mm;
    text-align: right;
  }
  .meta .value {
    min-width: 24mm;
    text-align: left;
    border-bottom: 1px solid rgba(0,0,0,.35);
    padding: 0 2px 1px;
  }
  .title {
    width: 151mm;
    margin: 4mm auto 6mm;
    border: 1.2px solid #4d4d4d;
    background: linear-gradient(180deg, rgba(231,243,242,.94), rgba(217,234,233,.9));
    padding: 9px 10px 8px;
    text-align: center;
    font-size: 17.2px;
    font-weight: 700;
    letter-spacing: 0.35px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    background: rgba(255,255,255,0.24);
  }
  td {
    border: 1px solid var(--line);
    padding: 2.2px 4.5px;
    vertical-align: middle;
    overflow-wrap: anywhere;
  }
  .label { font-weight: 700; font-size: 8.3px; }
  .center { text-align: center; }
  .bold { font-weight: 700; }

  .top-fields td { height: 5.8mm; font-size: 8.5px; }
  .top-fields .hdr td {
    font-weight: 700;
    font-size: 8.4px;
    height: 5mm;
  }
  .top-fields .col-tin { width: 39mm; }
  .top-fields .col-name { width: auto; }
  .top-fields .col-date { width: 36mm; text-align: center; }
  .top-fields .col-branch { width: 27mm; }

  .tax-table td {
    height: 18.6mm;
    font-size: 8px;
  }
  .tax-table .tax-name {
    width: 32mm;
    text-align: center;
    font-weight: 700;
    font-size: 8px;
    line-height: 1.12;
    white-space: pre-line;
  }
  .tax-table .code {
    width: 15mm;
    text-align: center;
    font-weight: 700;
  }
  .tax-table .date {
    width: 26mm;
    text-align: center;
  }
  .tax-table .frequency {
    width: 21mm;
    text-align: center;
    font-weight: 700;
  }
  .tax-table .details {
    text-align: center;
    font-size: 7.7px;
    line-height: 1.2;
    padding: 4px 5.5px;
  }

  .single-line td { height: 5.8mm; }
  .single-line .type-label { width: 32mm; }

  .section-label {
    margin: 0;
    padding: 3px 4px 2px;
    border: 1px solid var(--line);
    border-bottom: 0;
    background: linear-gradient(180deg, #e7f2f1, #d6eae9);
    font-weight: 700;
    font-size: 8.3px;
    letter-spacing: 0.15px;
  }

  .business-table .heading td {
    font-weight: 700;
    height: 5.4mm;
    font-size: 8px;
    text-align: center;
  }
  .business-table .col-type { width: 25mm; text-align: center; font-weight: 700; font-size: 7.9px; }
  .business-table .col-activity { width: 90mm; font-size: 7.9px; }
  .business-table .col-category { width: 24mm; text-align: center; font-size: 8.2px; }
  .business-table .col-regdate { text-align: center; font-size: 8.2px; }
  .business-table .trade td { height: 7mm; }
  .business-table .pair td { height: 8.1mm; }
  .business-table .blank td { height: 8mm; }

  .reminders td {
    vertical-align: top;
    padding: 2.5mm 2.8mm;
  }
  .reminders .heading {
    width: 24mm;
    font-weight: 700;
    text-align: center;
    vertical-align: middle;
  }
  .reminders ol {
    margin: 0;
    padding-left: 15px;
  }
  .reminders li {
    margin: 0 0 2px;
    font-size: 8px;
    line-height: 1.38;
  }
  .reminders li:last-child { margin-bottom: 0; }

  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      width: auto;
      min-height: auto;
    }
  }
`;

const cell = (
  value: string | number | null,
  className?: string,
  colspan?: number,
  rowspan?: number,
): JsonFormCell => ({
  value,
  className,
  colspan,
  rowspan,
});

const htmlCell = (
  html: string,
  className?: string,
  colspan?: number,
  rowspan?: number,
): JsonFormCell => ({
  html,
  className,
  colspan,
  rowspan,
});

function formatTaxCategory(category: Bir2303TaxItem["category"]): string {
  if (category === "WITHHOLDING TAX - FINAL") return "WITHHOLDING TAX -\nFINAL";
  return category;
}

function buildTaxTable(items: Bir2303TaxItem[]): JsonFormNode {
  return {
    type: "table",
    className: "tax-table",
    rows: items.map((item) => ({
      cells: [
        cell(formatTaxCategory(item.category), "tax-name"),
        cell(item.code, "code"),
        cell(item.effectiveDate, "date"),
        cell(item.frequency, "frequency"),
        cell(item.dueDate, "details"),
      ],
    })),
  };
}

function buildActivityTable(input: Bir2303Input): JsonFormNode {
  const activities = input.activities.length
    ? input.activities
    : [
        {
          psic: "",
          lineOfBusiness: input.businessName || "—",
          category: input.category || "Primary",
        },
      ];

  const rows: JsonFormRow[] = [
    {
      className: "heading",
      cells: [
        cell("", "col-type"),
        cell("", "col-activity"),
        cell("CATEGORY", "col-category"),
        cell("REGISTRATION DATE", "col-regdate"),
      ],
    },
  ];

  activities.forEach((activity, index) => {
    const category = activity.category || (index === 0 ? "Primary" : "Secondary");
    const psicCode = activity.psic?.trim() || "";
    const line = activity.lineOfBusiness || "—";
    const psicCombined = psicCode ? `${psicCode}-${line}` : line;
    const tradeLabel = index === 0 ? "TRADE NAME 1" : "";

    if (index === 0) {
      rows.push({
        className: "trade",
        cells: [
          cell(tradeLabel, "col-type"),
          cell(psicCombined, "col-activity"),
          cell(category, "col-category", 1, 3),
          cell(input.registrationDate, "col-regdate"),
        ],
      });
    } else {
      rows.push({
        className: "pair",
        cells: [
          cell("(PSIC)", "col-type"),
          cell(psicCombined, "col-activity"),
          cell(category, "col-category", 1, 2),
          cell(""),
        ],
      });
      rows.push({
        className: "pair",
        cells: [cell("Line of Business", "col-type"), cell(line, "col-activity"), cell("")],
      });
      return;
    }

    rows.push({
      className: "pair",
      cells: [cell("(PSIC)", "col-type"), cell(psicCombined, "col-activity"), cell("")],
    });
    rows.push({
      className: "pair",
      cells: [cell("Line of Business", "col-type"), cell(line, "col-activity"), cell("")],
    });
  });

  const activitySlots = Math.max(4, activities.length);
  for (let index = activities.length; index < activitySlots; index += 1) {
    rows.push({
      className: "blank",
      cells: [
        cell("(PSIC)", "col-type"),
        cell("", "col-activity"),
        cell(index === 0 ? "Primary" : "Secondary", "col-category", 1, 2),
        cell(""),
      ],
    });
    rows.push({
      className: "blank",
      cells: [cell("Line of Business", "col-type"), cell("", "col-activity"), cell("")],
    });
  }

  return { type: "table", className: "business-table", rows };
}

export function buildBir2303Input(business: RegisteredBusiness): Bir2303Input {
  const registrationDate = new Date(business.finalizedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const activity = business.businessActivity || "GENERAL BUSINESS ACTIVITY";

  return {
    ocn:
      business.records.find(
        (record) =>
          record.kind === "registration" && record.agency === "Bureau of Internal Revenue",
      )?.referenceNumber ||
      business.registrationNumber ||
      "—",
    dateOcnGenerated: registrationDate,
    tin: business.tinMasked || "—",
    branchCode: "00000",
    taxpayerName: business.ownerName || business.name,
    tinIssuanceDate: registrationDate,
    registeredOffice: "Head Office",
    registeredAddress: business.businessAddress || "—",
    taxpayerType:
      business.type === "Self-employed"
        ? "INDIVIDUAL"
        : (business.type || "INDIVIDUAL").toUpperCase(),
    businessName: business.name,
    category: "Primary",
    registrationDate,
    revenueRegion: "REVENUE REGION NO. 07B - EAST NCR",
    revenueDistrictOffice: "REVENUE DISTRICT OFFICE NO. 043 - PASIG",
    activities: [{ psic: "", lineOfBusiness: activity, category: "Primary" }],
    taxItems: [
      {
        category: "EXPANDED/OTHERS",
        code: "",
        effectiveDate: registrationDate.split(", ").pop() || registrationDate,
        frequency: "",
        dueDate: "month following the month in which withholding was made.",
      },
      {
        category: "WITHHOLDING TAX - FINAL",
        code: "0619F",
        effectiveDate: registrationDate,
        frequency: "MONTHLY",
        dueDate: "On or before the 10th day following the month in which withholding was made.",
      },
      {
        category: "WITHHOLDING TAX - FINAL",
        code: "1604F",
        effectiveDate: registrationDate,
        frequency: "ANNUALLY",
        dueDate:
          "On or before January 31 of the year following the calendar year in which the income payments subject to final withholding taxes were paid or accrued",
      },
      {
        category: "WITHHOLDING TAX - FINAL",
        code: "1601FQ",
        effectiveDate: registrationDate,
        frequency: "QUARTERLY",
        dueDate:
          "Not later than the last day of the month following the close of the quarter during which withholding was made",
      },
    ],
    reminders: [
      "An annual registration fee shall be paid upon registration and every year thereafter on or before the last day of January, using BIR Form No. 0605.",
      "Filing of required tax returns to conform with the above tax types, whether with or without business operation, to avoid penalties.",
    ],
  };
}

export function generateBir2303Html(input: Bir2303Input): string {
  const isHeadOffice = /head\s*office/i.test(input.registeredOffice);
  const officeHtml = isHeadOffice
    ? "<strong>X</strong>&nbsp;&nbsp;Head Office&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Branch"
    : "Head Office&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>X</strong>&nbsp;&nbsp;Branch";

  const form: JsonFormNode[] = [
    {
      type: "section",
      className: "certificate",
      children: [
        {
          type: "html",
          className: "top",
          html: `
            <div>
              <div class="form-number">2303</div>
              <div class="revision">REVISED APRIL 2019</div>
            </div>
            <div class="republic">
              REPUBLIKA NG PILIPINAS<br>
              KAGAWARAN NG PANANALAPI<br>
              <span class="agency">KAWANIHAN NG RENTAS INTERNAS</span>
              <img
                class="seal"
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Logo_of_the_Bureau_of_Internal_Revenue.png/500px-Logo_of_the_Bureau_of_Internal_Revenue.png"
                alt="Bureau of Internal Revenue logo"
                width="42"
                height="42"
              >
              <div class="office">${escapeHtml(input.revenueRegion)}</div>
              <div class="office">${escapeHtml(input.revenueDistrictOffice)}</div>
            </div>
            <div class="meta">
              <div class="row"><span class="label">OCN:</span><span class="value">${escapeHtml(input.ocn)}</span></div>
              <div class="row"><span class="label">Date OCN Generated:</span><span class="value">${escapeHtml(input.dateOcnGenerated)}</span></div>
            </div>
          `,
        },
        { type: "text", className: "title", value: "CERTIFICATE OF REGISTRATION" },
        {
          type: "table",
          className: "top-fields",
          rows: [
            {
              className: "hdr",
              cells: [
                cell("TIN & BRANCH CODE", "col-tin"),
                cell("NAME OF TAXPAYER", "col-name"),
                cell("TIN ISSUANCE DATE", "col-date"),
              ],
            },
            {
              cells: [
                cell(`${input.tin} ${input.branchCode}`.trim(), "col-tin"),
                cell(input.taxpayerName, "bold col-name"),
                cell(input.tinIssuanceDate, "col-date", 1, 2),
              ],
            },
            {
              cells: [
                cell("REGISTERING OFFICE", "label col-tin"),
                htmlCell(officeHtml, "col-name"),
              ],
            },
            {
              cells: [
                cell("REGISTERED ADDRESS", "label col-tin"),
                cell(input.registeredAddress, "col-name", 2),
              ],
            },
          ],
        },
        buildTaxTable(input.taxItems),
        {
          type: "table",
          className: "single-line",
          rows: [
            {
              cells: [
                cell("TAXPAYER TYPE/S", "label type-label"),
                cell(input.taxpayerType, "bold", 4),
              ],
            },
          ],
        },
        {
          type: "text",
          className: "section-label",
          value: "BUSINESS INFORMATION DETAILS",
        },
        buildActivityTable(input),
        {
          type: "table",
          className: "reminders",
          rows: [
            {
              cells: [
                cell("REMINDERS", "heading"),
                htmlCell(
                  `<ol>${input.reminders
                    .map((reminder) => `<li>${escapeHtmlWithBreaks(reminder)}</li>`)
                    .join("")}</ol>`,
                ),
              ],
            },
          ],
        },
      ],
    },
  ];

  return renderJsonFormHtml({
    title: "BIR Certificate of Registration (Form 2303)",
    style: certificateStyle,
    body: form,
  });
}

export function createBir2303FileMetadata(
  createdAt: string = new Date().toISOString(),
): BusinessFile {
  return {
    id: "bir-form-2303",
    title: "BIR Certificate of Registration (Form 2303)",
    filename: "BIR-Certificate-of-Registration-2303.html",
    documentType: "Certificate of Registration",
    status: "Available",
    createdAt,
    url: null,
    note: "Generated by DX BIR from the completed taxpayer registration record.",
    source: "DX",
  };
}
