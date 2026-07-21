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
  demo: true;
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
};

export type RegisteredBusinessListItem = Pick<
  RegisteredBusiness,
  "id" | "name" | "type" | "registrationNumber" | "status" | "finalizedAt"
> & {
  nextTaxDue: string | null;
};

export type BusinessFinalizationInput = Omit<RegisteredBusiness, "id" | "finalizedAt"> & {
  finalizedAt?: string;
};
