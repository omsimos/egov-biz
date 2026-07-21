import type {
  BusinessFinalizationInput,
  BusinessRecord,
  TaxObligation,
} from "@/lib/registered-business";
import type {
  BarangayClearance,
  DtiBusinessNameForm,
  EbplsBusinessPermitReceipt,
} from "@/lib/business-chat";
import type { CitizenProfile } from "@/lib/citizen-profile";
import type { BusinessPlan } from "@/lib/questions";

export type MockComplianceBundle = {
  records: BusinessRecord[];
  taxObligations: TaxObligation[];
};

function demoReference(prefix: string, seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `DEMO-${prefix}-${Math.abs(hash >>> 0)
    .toString(36)
    .toUpperCase()
    .padStart(7, "0")}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nextDate(now: Date, month: number, day: number) {
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  if (candidate <= now) candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  return candidate;
}

function nextMonthDue(now: Date, day: number) {
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
  return candidate;
}

function nextQuarterDue(now: Date, day: number) {
  const quarterEndMonths = [2, 5, 8, 11];
  const month = quarterEndMonths.find((value) => value >= now.getUTCMonth()) ?? 2;
  const year = month < now.getUTCMonth() ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const due = new Date(Date.UTC(year, month + 1, day));
  if (due <= now) due.setUTCMonth(due.getUTCMonth() + 3);
  return due;
}

export function buildTaxObligations(now = new Date()): TaxObligation[] {
  const monthly = nextMonthDue(now, 10);
  const quarterly = nextQuarterDue(now, 25);
  const annual = nextDate(now, 3, 15);
  const annualRegistration = nextDate(now, 0, 31);

  const obligations: TaxObligation[] = [
    {
      id: `withholding-${isoDate(monthly)}`,
      title: "Monthly withholding tax return",
      formCode: "BIR Form 0619E",
      frequency: "Monthly",
      periodLabel: monthly.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      dueDate: isoDate(monthly),
      status: "Scheduled",
      note: "Mock schedule. Confirm the registered tax types and filing deadline with BIR.",
    },
    {
      id: `income-${isoDate(quarterly)}`,
      title: "Quarterly income tax return",
      formCode: "BIR Form 1701Q",
      frequency: "Quarterly",
      periodLabel: `Quarter ending ${quarterly.toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "UTC" })}`,
      dueDate: isoDate(quarterly),
      status: "Upcoming",
      note: "Mock schedule based on a sole-proprietor demo profile.",
    },
    {
      id: `annual-income-${isoDate(annual)}`,
      title: "Annual income tax return",
      formCode: "BIR Form 1701A",
      frequency: "Annual",
      periodLabel: String(annual.getUTCFullYear() - 1),
      dueDate: isoDate(annual),
      status: "Upcoming",
      note: "Mock annual deadline. Actual form and due date depend on taxpayer classification.",
    },
    {
      id: `annual-registration-${isoDate(annualRegistration)}`,
      title: "Annual registration review",
      formCode: "BIR registration",
      frequency: "Annual",
      periodLabel: String(annualRegistration.getUTCFullYear()),
      dueDate: isoDate(annualRegistration),
      status: "Upcoming",
      note: "Review registration details, books, invoices, and tax types for the new year.",
    },
  ];
  return obligations.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export function buildMockCompliance(
  plan: BusinessPlan,
  receipt: EbplsBusinessPermitReceipt,
  now = new Date(),
): MockComplianceBundle {
  const seed = `${receipt.referenceNumber}:${receipt.businessName}`;
  const issuedAt = now.toISOString();
  const records: BusinessRecord[] = [
    {
      id: "bir-registration",
      kind: "tax",
      agency: "Bureau of Internal Revenue",
      title: "BIR taxpayer registration",
      referenceNumber: demoReference("BIR", seed),
      status: "Active",
      issuedAt,
      validUntil: null,
      note: "Demo registration linked to the authenticated citizen profile. Not an official BIR record.",
      demo: true,
    },
    {
      id: "books-of-accounts",
      kind: "tax",
      agency: "Bureau of Internal Revenue",
      title: "Books of accounts",
      referenceNumber: demoReference("BOOKS", seed),
      status: "Configured",
      issuedAt,
      validUntil: null,
      note: "Cash receipts, cash disbursements, general journal, and general ledger configured for the demo.",
      demo: true,
    },
    {
      id: "invoice-setup",
      kind: "tax",
      agency: "Bureau of Internal Revenue",
      title: "Invoice setup",
      referenceNumber: demoReference("INV", seed),
      status: "Configured",
      issuedAt,
      validUntil: null,
      note: "Sample invoice numbering and retention workflow configured. No authority to print is represented.",
      demo: true,
    },
  ];

  const sectorRecords: BusinessRecord[] = [];
  if (plan.flags.includes("physical-premises"))
    sectorRecords.push({
      id: "fire-safety",
      kind: "permit",
      agency: "Bureau of Fire Protection",
      title: "Fire safety inspection certificate",
      referenceNumber: demoReference("BFP", seed),
      status: "Issued",
      issuedAt,
      validUntil: receipt.validUntil,
      note: "Mock fire-safety result for the declared premises.",
      demo: true,
    });
  if (plan.flags.includes("food"))
    sectorRecords.push({
      id: "sanitary-permit",
      kind: "permit",
      agency: `${receipt.city} health office`,
      title: "Sanitary permit",
      referenceNumber: demoReference("SAN", seed),
      status: "Issued",
      issuedAt,
      validUntil: receipt.validUntil,
      note: "Mock sanitary permit for food handling or service.",
      demo: true,
    });
  if (plan.flags.includes("food-manufacturing"))
    sectorRecords.push({
      id: "fda-review",
      kind: "permit",
      agency: "Food and Drug Administration Philippines",
      title: "FDA establishment review",
      referenceNumber: demoReference("FDA", seed),
      status: "Issued",
      issuedAt,
      validUntil: null,
      note: "Demo-only sector review. Actual license and product requirements depend on operations.",
      demo: true,
    });
  if (plan.flags.includes("vehicles"))
    sectorRecords.push({
      id: "vehicle-records",
      kind: "permit",
      agency: "Land Transportation Office",
      title: "Vehicle registration review",
      referenceNumber: demoReference("LTO", seed),
      status: "Configured",
      issuedAt,
      validUntil: null,
      note: "Demo checklist for valid vehicle registration and operating records.",
      demo: true,
    });
  if (!sectorRecords.length)
    sectorRecords.push({
      id: "sector-permits",
      kind: "permit",
      agency: "Local licensing office",
      title: "Additional sector permits",
      referenceNumber: demoReference("SECTOR", seed),
      status: "Not required",
      issuedAt,
      validUntil: null,
      note: "No additional food, fire, sanitary, vehicle, or sector permit was inferred for this demo route.",
      demo: true,
    });
  records.push(...sectorRecords);

  const employerRequired = plan.flags.includes("employees") || plan.people > 1;
  for (const [id, agency, title, prefix] of [
    ["sss-employer", "Social Security System", "SSS employer registration", "SSS"],
    ["philhealth-employer", "PhilHealth", "PhilHealth employer registration", "PHIC"],
    ["pagibig-employer", "Pag-IBIG Fund", "Pag-IBIG employer registration", "HDMF"],
  ] as const)
    records.push({
      id,
      kind: "employer",
      agency,
      title,
      referenceNumber: demoReference(prefix, seed),
      status: employerRequired ? "Active" : "Not required",
      issuedAt: employerRequired ? issuedAt : null,
      validUntil: null,
      note: employerRequired
        ? "Mock employer account. Employee reporting and contributions remain recurring obligations."
        : "No employees were declared. Register before hiring the first employee.",
      demo: true,
    });

  records.push({
    id: "renewal-calendar",
    kind: "renewal",
    agency: "eGovPH Business",
    title: "Renewals and filing calendar",
    referenceNumber: demoReference("CAL", seed),
    status: "Scheduled",
    issuedAt,
    validUntil: null,
    note: "Demo reminders created for tax filings, permit validity, and annual registration review.",
    demo: true,
  });

  return { records, taxObligations: buildTaxObligations(now) };
}

export function buildFinalBusiness(input: {
  conversationId: string;
  profile: CitizenProfile;
  plan: BusinessPlan;
  dtiForm: DtiBusinessNameForm | null;
  clearance: BarangayClearance | null;
  receipt: EbplsBusinessPermitReceipt;
  compliance: MockComplianceBundle;
}): BusinessFinalizationInput {
  const { conversationId, profile, plan, dtiForm, clearance, receipt, compliance } = input;
  const baseRecords: BusinessRecord[] = [
    ...(dtiForm
      ? [
          {
            id: "business-name-registration",
            kind: "registration" as const,
            agency: "Department of Trade and Industry",
            title: "Business name registration",
            referenceNumber: `DEMO-DTI-${receipt.referenceNumber.split("-").at(-1)}`,
            status: "Issued" as const,
            issuedAt: receipt.submittedAt,
            validUntil: null,
            note: "Mock DTI business-name record generated by this demo.",
            demo: true as const,
          },
        ]
      : []),
    ...(clearance
      ? [
          {
            id: "barangay-clearance",
            kind: "permit" as const,
            agency: `${clearance.barangay}, ${clearance.city}`,
            title: "Barangay business clearance",
            referenceNumber: clearance.referenceNumber,
            status: "Issued" as const,
            issuedAt: clearance.approvedAt,
            validUntil: clearance.validUntil,
            note: "Mock barangay clearance generated by this demo.",
            demo: true as const,
          },
        ]
      : []),
    {
      id: "business-permit",
      kind: "permit" as const,
      agency: `${receipt.city} EBPLS`,
      title: "Mayor's / business permit",
      referenceNumber: receipt.referenceNumber,
      status: "Issued" as const,
      issuedAt: receipt.issuedAt,
      validUntil: receipt.validUntil,
      note: "Mock EBPLS permit generated by this demo.",
      demo: true as const,
    },
  ];
  return {
    conversationId,
    name: receipt.businessName,
    type: plan.registrationType,
    category: plan.category,
    registrationNumber: receipt.referenceNumber,
    status: "Active",
    ownerName: receipt.ownerName || profile.fullName,
    businessActivity: receipt.businessActivity,
    businessAddress: receipt.businessAddress,
    city: receipt.city,
    rdo: plan.rdo ? `${plan.rdo.code} - ${plan.rdo.name}` : profile.rdo,
    tinMasked: profile.tinMasked,
    records: [...baseRecords, ...compliance.records],
    taxObligations: compliance.taxObligations,
  };
}
