import type { RegisteredBusiness } from "@/lib/registered-business";

function formatDate(value: string) {
  return new Date(`${value.length === 10 ? `${value}T00:00:00Z` : value}`).toLocaleDateString(
    "en-PH",
    { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" },
  );
}

export function businessManagementContext(business: RegisteredBusiness) {
  return {
    business: {
      activity: business.businessActivity,
      address: business.businessAddress,
      city: business.city,
      name: business.name,
      owner: business.ownerName,
      rdo: business.rdo,
      registrationNumber: business.registrationNumber,
      status: business.status,
      tinMasked: business.tinMasked,
      type: business.type,
    },
    files: business.files.map((file) => ({
      createdAt: file.createdAt,
      documentType: file.documentType,
      filename: file.filename,
      note: file.note,
      status: file.status,
      title: file.title,
    })),
    records: business.records.map((record) => ({
      agency: record.agency,
      note: record.note,
      referenceNumber: record.referenceNumber,
      status: record.status,
      title: record.title,
      validUntil: record.validUntil,
    })),
    taxCalendar: business.taxObligations.map((obligation) => ({
      dueDate: obligation.dueDate,
      formCode: obligation.formCode,
      frequency: obligation.frequency,
      note: obligation.note,
      period: obligation.periodLabel,
      status: obligation.status,
      title: obligation.title,
    })),
  };
}

function taxCalendarAnswer(business: RegisteredBusiness) {
  if (!business.taxObligations.length)
    return `There are no authoritative tax reminders saved for **${business.name}**. Its DX BIR registration record and generated forms are available, but no recurring tax types or filing deadlines have been assigned yet; confirm those directly with BIR.`;
  const entries = business.taxObligations
    .slice(0, 4)
    .map(
      (item) =>
        `- **${formatDate(item.dueDate)}** — ${item.title} (${item.formCode}, ${item.periodLabel})`,
    )
    .join("\n");
  return `Here are the next saved tax reminders for **${business.name}**:\n\n${entries}\n\nConfirm the actual forms and deadlines with BIR before filing.`;
}

function filesAnswer(business: RegisteredBusiness) {
  if (!business.files.length)
    return `There are no files saved for **${business.name}** yet. Generated registration and tax documents will appear in the Files tab.`;
  const entries = business.files
    .slice(0, 6)
    .map((file) => `- **${file.title}** — ${file.documentType} · ${file.status}`)
    .join("\n");
  return `These files are saved for **${business.name}**:\n\n${entries}\n\nOpen the Files tab to view the available documents.`;
}

function complianceAnswer(business: RegisteredBusiness, prompt: string) {
  const asksAboutFire = /\bfire|bfp|safety\b/i.test(prompt);
  const relevant = asksAboutFire
    ? business.records.filter((record) =>
        /\bfire|bfp|safety\b/i.test(`${record.title} ${record.agency}`),
      )
    : business.records.filter(
        (record) => record.status === "Scheduled" || record.status === "Not required",
      );
  if (asksAboutFire && !relevant.length)
    return `I don’t see a fire-safety record for **${business.name}** in the saved business record. Check the Records tab and confirm the premises requirements with the local BFP office.`;
  if (!relevant.length)
    return `The saved records for **${business.name}** do not show an unfinished registration or permit item. Ongoing tax filings, renewals, and employer obligations can still recur after registration, so use the Tax calendar and Records tabs as the current checklist.`;
  const entries = relevant
    .map((record) => `- **${record.title}** — ${record.status}. ${record.note}`)
    .join("\n");
  return `Here’s what the DX-backed record shows for **${business.name}**:\n\n${entries}\n\nIf a requirement is not represented by BNRS, LGU, or BIR DX, confirm it with the responsible agency.`;
}

export function deterministicBusinessManagementResponse(
  business: RegisteredBusiness,
  prompt: string,
) {
  if (/\btax|calendar|filing|deadline|due\b/i.test(prompt)) return taxCalendarAnswer(business);
  if (/\bfile|document|certificate|pdf|form\b/i.test(prompt)) return filesAnswer(business);
  if (/\bfire|bfp|safety|permit|compliance|step|remaining|still need|todo|to-do\b/i.test(prompt))
    return complianceAnswer(business, prompt);

  const nextDue = business.taxObligations[0];
  return `**${business.name}** is saved as an active ${business.type.toLowerCase()} business in ${business.city}, with registration number **${business.registrationNumber}**.${
    nextDue
      ? ` The next calendar item is **${nextDue.title}** on **${formatDate(nextDue.dueDate)}**.`
      : ""
  }\n\nYou can ask me about its generated BIR forms, BNRS registration, LGU permit and clearance, or what is not yet represented by the available DX modules.`;
}
