export type BirDemoBusinessType = "Self-employed" | "Sole proprietor" | "Company";

export type BirDemoTaxCalendarFrequency = "Monthly" | "Quarterly" | "Annual";

export type BirDemoTaxCalendarEntry = {
  id: string;
  businessType: BirDemoBusinessType;
  title: string;
  formCode: string;
  frequency: BirDemoTaxCalendarFrequency;
  periodLabel: string;
  dueDate: string;
  status: "Upcoming" | "Scheduled";
  note: string;
  simulated: true;
};

export type CreateBirDemoTaxCalendarInput = {
  businessType: BirDemoBusinessType;
  asOf?: Date;
};

type CalendarCandidate = Omit<BirDemoTaxCalendarEntry, "id" | "status">;

const SHARED_NOTE =
  "Demo reminder based only on business type. Confirm registered tax types and deadlines with BIR.";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function nextAnnualDate(asOf: Date, month: number, day: number) {
  const candidate = new Date(Date.UTC(asOf.getUTCFullYear(), month, day));
  if (candidate < asOf) candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  return candidate;
}

function nextScheduledDate(
  asOf: Date,
  schedule: ReadonlyArray<Readonly<{ month: number; day: number }>>,
) {
  for (const item of schedule) {
    const candidate = new Date(Date.UTC(asOf.getUTCFullYear(), item.month, item.day));
    if (candidate >= asOf) return candidate;
  }
  const first = schedule[0];
  if (!first) throw new RangeError("A demo tax-calendar schedule cannot be empty.");
  return new Date(Date.UTC(asOf.getUTCFullYear() + 1, first.month, first.day));
}

function nextMonthlyDate(asOf: Date, day: number) {
  const candidate = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), day));
  if (candidate < asOf) candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  return candidate;
}

function quarterlyPeriod(dueDate: Date, dueMonthToQuarter: Readonly<Record<number, string>>) {
  const quarter = dueMonthToQuarter[dueDate.getUTCMonth()];
  if (!quarter) throw new RangeError("The demo tax-calendar due month is not configured.");
  const periodYear =
    dueDate.getUTCMonth() === 0 ? dueDate.getUTCFullYear() - 1 : dueDate.getUTCFullYear();
  return `${quarter} ${periodYear}`;
}

function individualCandidates(
  businessType: "Self-employed" | "Sole proprietor",
  asOf: Date,
): CalendarCandidate[] {
  const incomeQuarter = nextScheduledDate(asOf, [
    { month: 4, day: 15 },
    { month: 7, day: 15 },
    { month: 10, day: 15 },
  ]);
  const percentageTaxQuarter = nextScheduledDate(asOf, [
    { month: 0, day: 25 },
    { month: 3, day: 25 },
    { month: 6, day: 25 },
    { month: 9, day: 25 },
  ]);
  const annualReview = nextAnnualDate(asOf, 0, 31);
  const annualIncome = nextAnnualDate(asOf, 3, 15);

  return [
    {
      businessType,
      title:
        businessType === "Self-employed"
          ? "Quarterly professional income tax reminder"
          : "Quarterly business income tax reminder",
      formCode: "BIR Form 1701Q",
      frequency: "Quarterly",
      periodLabel: quarterlyPeriod(incomeQuarter, {
        4: "Q1",
        7: "Q2",
        10: "Q3",
      }),
      dueDate: isoDate(incomeQuarter),
      note: SHARED_NOTE,
      simulated: true,
    },
    {
      businessType,
      title: "Quarterly percentage tax reminder",
      formCode: "BIR Form 2551Q",
      frequency: "Quarterly",
      periodLabel: quarterlyPeriod(percentageTaxQuarter, {
        0: "Q4",
        3: "Q1",
        6: "Q2",
        9: "Q3",
      }),
      dueDate: isoDate(percentageTaxQuarter),
      note: SHARED_NOTE,
      simulated: true,
    },
    {
      businessType,
      title: "Books, invoices, and registration details review",
      formCode: "BIR registration",
      frequency: "Annual",
      periodLabel: String(annualReview.getUTCFullYear()),
      dueDate: isoDate(annualReview),
      note: SHARED_NOTE,
      simulated: true,
    },
    {
      businessType,
      title:
        businessType === "Self-employed"
          ? "Annual individual income tax reminder"
          : "Annual sole-proprietor income tax reminder",
      formCode: businessType === "Self-employed" ? "BIR Form 1701A" : "BIR Form 1701",
      frequency: "Annual",
      periodLabel: String(annualIncome.getUTCFullYear() - 1),
      dueDate: isoDate(annualIncome),
      note: SHARED_NOTE,
      simulated: true,
    },
  ];
}

function companyCandidates(asOf: Date): CalendarCandidate[] {
  const businessType = "Company" as const;
  const withholding = nextMonthlyDate(asOf, 10);
  const withholdingPeriod = new Date(
    Date.UTC(withholding.getUTCFullYear(), withholding.getUTCMonth() - 1, 1),
  );
  const incomeQuarter = nextScheduledDate(asOf, [
    { month: 4, day: 30 },
    { month: 7, day: 29 },
    { month: 10, day: 29 },
  ]);
  const percentageTaxQuarter = nextScheduledDate(asOf, [
    { month: 0, day: 25 },
    { month: 3, day: 25 },
    { month: 6, day: 25 },
    { month: 9, day: 25 },
  ]);
  const annualIncome = nextAnnualDate(asOf, 3, 15);

  return [
    {
      businessType,
      title: "Monthly withholding tax reminder",
      formCode: "BIR Form 0619E",
      frequency: "Monthly",
      periodLabel: formatMonth(withholdingPeriod),
      dueDate: isoDate(withholding),
      note: SHARED_NOTE,
      simulated: true,
    },
    {
      businessType,
      title: "Quarterly corporate income tax reminder",
      formCode: "BIR Form 1702Q",
      frequency: "Quarterly",
      periodLabel: quarterlyPeriod(incomeQuarter, {
        4: "Q1",
        7: "Q2",
        10: "Q3",
      }),
      dueDate: isoDate(incomeQuarter),
      note: SHARED_NOTE,
      simulated: true,
    },
    {
      businessType,
      title: "Quarterly percentage tax reminder",
      formCode: "BIR Form 2551Q",
      frequency: "Quarterly",
      periodLabel: quarterlyPeriod(percentageTaxQuarter, {
        0: "Q4",
        3: "Q1",
        6: "Q2",
        9: "Q3",
      }),
      dueDate: isoDate(percentageTaxQuarter),
      note: SHARED_NOTE,
      simulated: true,
    },
    {
      businessType,
      title: "Annual corporate income tax reminder",
      formCode: "BIR Form 1702-RT",
      frequency: "Annual",
      periodLabel: String(annualIncome.getUTCFullYear() - 1),
      dueDate: isoDate(annualIncome),
      note: SHARED_NOTE,
      simulated: true,
    },
  ];
}

/**
 * Builds four simulated reminders for the selected legal business type.
 *
 * This is demo data, not a tax determination. Business type alone cannot
 * establish a taxpayer's real tax types, filing forms, or deadlines.
 */
export function createBirDemoTaxCalendar({
  businessType,
  asOf = new Date(),
}: CreateBirDemoTaxCalendarInput): BirDemoTaxCalendarEntry[] {
  if (Number.isNaN(asOf.getTime()))
    throw new RangeError("The demo tax-calendar reference date must be valid.");
  const referenceDate = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );

  let candidates: CalendarCandidate[];
  switch (businessType) {
    case "Self-employed":
    case "Sole proprietor":
      candidates = individualCandidates(businessType, referenceDate);
      break;
    case "Company":
      candidates = companyCandidates(referenceDate);
      break;
    default:
      throw new RangeError(`Unsupported BIR demo business type: ${String(businessType)}`);
  }

  return candidates
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .map((candidate, index) => ({
      ...candidate,
      id: `${businessType.toLowerCase().replaceAll(" ", "-")}-${candidate.formCode
        .toLowerCase()
        .replaceAll(" ", "-")}-${candidate.dueDate}`,
      status: index === 0 ? "Upcoming" : "Scheduled",
    }));
}
