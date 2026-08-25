import type { BusinessPlan } from "@/lib/questions";

export type BusinessRecordKind = "registration" | "permit" | "tax" | "employer" | "renewal";

export type BusinessRecord = {
  id: string;
  kind: BusinessRecordKind;
  agency: string;
  title: string;
  referenceNumber: string;
  status: "Active" | "Configured" | "Issued" | "Not required" | "Scheduled";
  issuedAt: string | null;
  validUntil: string | null;
  note: string;
  source: "DX";
};

export type BusinessFile = {
  id: string;
  title: string;
  filename: string;
  documentType: string;
  status: "Generated" | "Available";
  createdAt: string;
  url: string | null;
  note: string;
  source: "DX";
};

export type TaxObligation = {
  id: string;
  title: string;
  formCode: string;
  frequency: "Monthly" | "Quarterly" | "Annual";
  periodLabel: string;
  dueDate: string;
  status: "Upcoming" | "Scheduled";
  note: string;
};

export type RegisteredBusiness = {
  id: string;
  conversationId: string;
  name: string;
  type: string;
  category: BusinessPlan["category"];
  registrationNumber: string;
  status: "Active" | "Draft";
  ownerName: string;
  businessActivity: string;
  businessAddress: string;
  city: string;
  rdo: string;
  tinMasked: string;
  finalizedAt: string;
  records: BusinessRecord[];
  taxObligations: TaxObligation[];
  files: BusinessFile[];
};

// The Business home's card leads with what the citizen came back for — where
// the business is, when it next has to file, and how much is on file — so the
// list carries those instead of the record page having to be opened for them.
// The three added fields are nullable because a BNRS-only registration (one
// that never reached the BIR step) has a certificate and nothing else, and
// inventing "0 records" for it would be a claim about a record that exists.
export type RegisteredBusinessListItem = Pick<
  RegisteredBusiness,
  "id" | "name" | "type" | "registrationNumber" | "status" | "finalizedAt"
> & {
  city: string | null;
  nextTaxDue: string | null;
  nextTaxTitle: string | null;
  recordCount: number | null;
  fileCount: number | null;
};

export type BusinessFinalizationInput = Omit<RegisteredBusiness, "id" | "finalizedAt"> & {
  finalizedAt?: string;
};
