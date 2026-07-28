import type { UIMessage } from "ai";
import type { BirFormArtifact } from "@/lib/bir-form/artifact";
import type { CitizenProfile } from "@/lib/citizen-profile";
import type { BusinessPlan, IntakeQuestion } from "@/lib/questions";
import type { BusinessRecord, TaxObligation } from "@/lib/registered-business";

export type DtiBusinessNameForm = {
  applicationType: "New registration";
  status: "Draft" | "Ready to submit" | "Submitted";
  proposedName: string;
  businessActivity: string;
  territorialScope: "Barangay" | "City / municipality" | "Regional" | "National";
  ownerName: string;
  businessAddress: string;
  city: string;
  feeLabel: string;
  missingFields: string[];
};

export type PaymentServiceType =
  | "dti-business-name"
  | "barangay-clearance"
  | "ebpls-business-permit";

export type AskUserAnswer = { questionId: string; value: string | string[]; labels: string[] };
export type AskUserInput = { questions: IntakeQuestion[]; question?: IntakeQuestion };
export type AskUserOutput = {
  answers: AskUserAnswer[];
  value?: string | string[];
  labels?: string[];
};
export type WebSearchInput = { query: string; numResults?: number };
export type WebSearchOutput = { results: { title: string; url: string }[] };
export type EditDtiInput = { form: DtiBusinessNameForm; note: string };
export type EditDtiOutput = { form: DtiBusinessNameForm };
export type BarangayClearanceApplication = {
  businessName: string;
  ownerName: string;
  businessActivity: string;
  businessAddress: string;
  barangay: string;
  city: string;
  registrationDocument: string;
  supportingDocuments: string[];
};
export type BarangayClearance = BarangayClearanceApplication & {
  status: "Payment required" | "Approved";
  referenceNumber: string;
  submittedAt: string;
  approvedAt: string | null;
  validUntil: string | null;
  feeLabel: string;
  usedFor: string[];
};
export type SubmitBarangayClearanceInput = { application: BarangayClearanceApplication };
export type SubmitBarangayClearanceOutput = { clearance: BarangayClearance };
export type EbplsBusinessPermitApplication = {
  system: "EBPLS";
  permitType: "New business permit";
  businessName: string;
  ownerName: string;
  businessActivity: string;
  businessAddress: string;
  barangay: string;
  city: string;
  barangayClearanceReference: string;
  registrationDocument: string;
  attachments: string[];
};
export type EbplsBusinessPermitReceipt = EbplsBusinessPermitApplication & {
  status: "Payment required" | "Permit issued";
  referenceNumber: string;
  submittedAt: string;
  issuedAt: string | null;
  validUntil: string | null;
  feeLabel: string;
  nextAction: string;
};
export type SubmitEbplsBusinessPermitInput = { application: EbplsBusinessPermitApplication };
export type SubmitEbplsBusinessPermitOutput = { receipt: EbplsBusinessPermitReceipt };
export type SetupBooksAndInvoicesOutput = { records: BusinessRecord[] };
export type PrepareSelfEmployedRegistrationOutput = {
  registrationType: "Self-employed";
  taxpayerName: string;
  professionalActivity: string;
  businessCity: string;
  rdo: string;
  addressSource: "Business address" | "Authenticated profile";
  status: "Ready for BIR form preparation";
  nextAction: string;
  demo: true;
};
export type SetupTaxComplianceOutput = {
  records: BusinessRecord[];
  obligations: TaxObligation[];
};
export type CompleteSectorPermitsOutput = { records: BusinessRecord[] };
export type RegisterEmployerAgenciesOutput = { records: BusinessRecord[] };
export type FinalizeBusinessRegistrationOutput = {
  businessId: string;
  businessName: string;
  status: "Active";
};
export type AgentPlanStep = {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
};
export type RegistrationPlan = { title: string; steps: AgentPlanStep[] };
export type UpdatePlanInput = RegistrationPlan & { note?: string };
export type UpdatePlanOutput = { plan: RegistrationPlan };
export type UserInfoOutput = {
  availableFields: Array<
    | "address"
    | "barangay"
    | "birthDate"
    | "email"
    | "fullName"
    | "gender"
    | "mobile"
    | "municipality"
    | "nationality"
    | "province"
  >;
  source: "eGov SSO";
};
export type GenerateBirFormOutput = {
  artifact: BirFormArtifact;
  source: "Authenticated eGov SSO profile";
};

export type BusinessChatTools = {
  user_info: { input: Record<string, never>; output: UserInfoOutput };
  generate_bir_form: { input: Record<string, never>; output: GenerateBirFormOutput };
  askUser: { input: AskUserInput; output: AskUserOutput };
  webSearch: { input: WebSearchInput; output: WebSearchOutput };
  editDtiBusinessNameForm: { input: EditDtiInput; output: EditDtiOutput };
  submitBarangayClearance: {
    input: SubmitBarangayClearanceInput;
    output: SubmitBarangayClearanceOutput;
  };
  prepareSelfEmployedRegistration: {
    input: Record<string, never>;
    output: PrepareSelfEmployedRegistrationOutput;
  };
  submitEbplsBusinessPermit: {
    input: SubmitEbplsBusinessPermitInput;
    output: SubmitEbplsBusinessPermitOutput;
  };
  setupBooksAndInvoices: {
    input: Record<string, never>;
    output: SetupBooksAndInvoicesOutput;
  };
  setupTaxCompliance: { input: Record<string, never>; output: SetupTaxComplianceOutput };
  completeSectorPermits: {
    input: Record<string, never>;
    output: CompleteSectorPermitsOutput;
  };
  registerEmployerAgencies: {
    input: Record<string, never>;
    output: RegisterEmployerAgenciesOutput;
  };
  finalizeBusinessRegistration: {
    input: Record<string, never>;
    output: FinalizeBusinessRegistrationOutput;
  };
  updatePlan: { input: UpdatePlanInput; output: UpdatePlanOutput };
};

export type BusinessChatData = {
  plan: { plan: BusinessPlan };
  paymentCompleted: { status: "paid"; serviceType: PaymentServiceType };
};

export type BusinessChatMessage = UIMessage<unknown, BusinessChatData, BusinessChatTools>;

/**
 * Keep the newest snapshot of a message while retaining its original position.
 * Streaming reconnects can briefly deliver the same message ID more than once;
 * the later snapshot contains the most complete set of streamed parts.
 */
export function uniqueMessagesById<T extends { id: string }>(messages: readonly T[]): T[] {
  const unique: T[] = [];
  const positions = new Map<string, number>();
  for (const message of messages) {
    const position = positions.get(message.id);
    if (position === undefined) {
      positions.set(message.id, unique.length);
      unique.push(message);
    } else {
      unique[position] = message;
    }
  }
  return unique;
}

// How far a saved plan actually got. `completed` counts only steps marked
// completed, matching the plan dock's own n/total chip; `done` also accepts
// skipped steps, because a plan whose remaining work was deliberately skipped
// is finished, not abandoned. Null when a conversation has no plan yet.
export type PlanProgress = { completed: number; total: number; done: boolean };

export type ConversationSummary = {
  id: string;
  title: string;
  initialPrompt: string;
  activeStreamId: string | null;
  createdAt: string;
  updatedAt: string;
  progress: PlanProgress | null;
};

export type BusinessConversation = ConversationSummary & {
  messages: BusinessChatMessage[];
  paymentStatus?: string | null;
  paymentStatuses?: Partial<Record<PaymentServiceType, string>>;
};

export type BusinessChatContext = {
  profile: CitizenProfile | null;
  initialPrompt: string;
};

// The most recent updatePlan in a parts array, streaming or settled. Shared so
// the chat dock and the conversations list read a plan the same way — they
// disagreed silently before, and the list had no view of plans at all.
export function latestPlanInParts(
  parts: BusinessChatMessage["parts"],
): { plan: RegistrationPlan; active: boolean } | null {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part.type !== "tool-updatePlan") continue;
    if (part.state === "output-available") return { active: false, plan: part.output.plan };
    if (part.state === "input-available")
      return { active: true, plan: { steps: part.input.steps, title: part.input.title } };
  }
  return null;
}

export function latestRegistrationPlan(messages: Pick<BusinessChatMessage, "parts">[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const found = latestPlanInParts(messages[index].parts);
    if (found) return found;
  }
  return null;
}

export function planProgress(plan: RegistrationPlan): PlanProgress {
  const completed = plan.steps.filter((step) => step.status === "completed").length;
  const resolved = plan.steps.filter(
    (step) => step.status === "completed" || step.status === "skipped",
  ).length;
  return {
    completed,
    done: plan.steps.length > 0 && resolved === plan.steps.length,
    total: plan.steps.length,
  };
}
