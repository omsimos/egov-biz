import {
  BookOpenTextIcon,
  BuildingsIcon,
  CalendarCheckIcon,
  CalendarDotsIcon,
  CertificateIcon,
  FileTextIcon,
  FireExtinguisherIcon,
  HeartbeatIcon,
  type Icon as PhosphorIcon,
  IdentificationBadgeIcon,
  ReceiptIcon,
  SealCheckIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { BusinessFile, BusinessRecord } from "@/lib/registered-business";

/**
 * The record and file lists are grouped and glyphed by which agency issued the
 * thing and what kind of thing it is, so a row does not have to repeat its
 * agency name in its own copy to be placeable. Both are derived here rather
 * than stored, because the API returns free-text agency names straight from the
 * DX services ("Bureau of Internal Revenue", "Makati City", "BFP Region IV-A")
 * and matching them is presentation, not data.
 */
export type RecordTone = "blue" | "amber" | "red" | "green" | "grey";

// bg + ink pairs, all from the token layer. Keyed rather than inlined so a row,
// a group dot and a stat tile that mean the same agency cannot drift apart.
export const TONE_TILE: Record<RecordTone, string> = {
  amber: "bg-orange-soft text-orange-ink",
  blue: "bg-secondary text-primary",
  green: "bg-success-soft text-success",
  grey: "bg-muted text-muted-foreground",
  red: "bg-destructive-soft text-[var(--flag-red)]",
};

export const TONE_DOT: Record<RecordTone, string> = {
  amber: "bg-[var(--egov-orange)]",
  blue: "bg-primary",
  green: "bg-success",
  grey: "bg-gray-500",
  red: "bg-[var(--flag-red)]",
};

// Order matters: the first pattern that matches wins, so the narrow agencies
// (fire, health) are tested before the broad local-government one that would
// otherwise swallow "Makati City health office".
const AGENCY_TONES: [RegExp, RecordTone][] = [
  [/fire|\bbfp\b/i, "red"],
  [/health|sanitar/i, "green"],
  [/internal revenue|\bbir\b/i, "blue"],
  [/trade and industry|\bdti\b|bnrs/i, "blue"],
  [/egov/i, "blue"],
  [/city|municipal|barangay|\blgu\b|ebpls/i, "amber"],
];

export function agencyTone(agency: string): RecordTone {
  return AGENCY_TONES.find(([pattern]) => pattern.test(agency))?.[1] ?? "grey";
}

const RECORD_TITLE_ICONS: [RegExp, PhosphorIcon][] = [
  [/books?\b|accounts/i, BookOpenTextIcon],
  [/invoice|receipt/i, ReceiptIcon],
  [/fire/i, FireExtinguisherIcon],
  [/sanitar|health/i, HeartbeatIcon],
  [/permit|clearance/i, BuildingsIcon],
  [/calendar|renewal/i, CalendarCheckIcon],
  [/taxpayer|registration|certificate/i, IdentificationBadgeIcon],
];

const RECORD_KIND_ICONS: Record<BusinessRecord["kind"], PhosphorIcon> = {
  employer: UsersThreeIcon,
  permit: BuildingsIcon,
  registration: IdentificationBadgeIcon,
  renewal: CalendarCheckIcon,
  tax: ReceiptIcon,
};

/** Title first, kind as the floor: "Books of accounts" is a `tax` record. */
export function recordIcon(record: BusinessRecord): PhosphorIcon {
  return (
    RECORD_TITLE_ICONS.find(([pattern]) => pattern.test(record.title))?.[1] ??
    RECORD_KIND_ICONS[record.kind] ??
    SealCheckIcon
  );
}

const FILE_GLYPHS: [RegExp, PhosphorIcon, RecordTone][] = [
  [/certificate|2303/i, CertificateIcon, "amber"],
  [/books?|invoice/i, BookOpenTextIcon, "green"],
  [/calendar|filing schedule/i, CalendarDotsIcon, "red"],
];

export function fileGlyph(file: BusinessFile): { Icon: PhosphorIcon; tone: RecordTone } {
  const haystack = `${file.title} ${file.documentType} ${file.filename}`;
  const match = FILE_GLYPHS.find(([pattern]) => pattern.test(haystack));
  // A prefilled form is the default because that is what the BIR service
  // generates most of; everything else is a document it stored afterwards.
  return match ? { Icon: match[1], tone: match[2] } : { Icon: FileTextIcon, tone: "blue" };
}

/**
 * Badge variant per status. "Scheduled" is the one that is neither done nor
 * absent — something the citizen still has to do — so it takes the brand tint
 * rather than the green every other present status gets.
 */
export function statusVariant(status: BusinessRecord["status"] | BusinessFile["status"]) {
  if (status === "Not required") return "neutral" as const;
  if (status === "Scheduled" || status === "Generated") return "primary" as const;
  return "success" as const;
}

/** Groups in the order the API returned them, so the newest agency stays last. */
export function groupRecordsByAgency(records: BusinessRecord[]) {
  const groups = new Map<string, BusinessRecord[]>();
  for (const record of records) {
    const existing = groups.get(record.agency);
    if (existing) existing.push(record);
    else groups.set(record.agency, [record]);
  }
  return [...groups].map(([agency, items]) => ({
    agency,
    count: items.length === 1 ? "1 record" : `${items.length} records`,
    items,
    tone: agencyTone(agency),
  }));
}
