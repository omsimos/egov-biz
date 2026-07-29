import type { UIMessage } from "ai";
import type { GenerateBirFormInput } from "@repo/dx/bir";
import type { BirFormArtifact } from "@/lib/bir-form/artifact";
import type { CitizenProfile } from "@/lib/citizen-profile";
import type {
  SendSmsMessageInput,
  SendSmsMessageOutput,
  SimulateTaxPaymentReminderInput,
  SimulateTaxPaymentReminderOutput,
} from "@/lib/emessage";
import type { BusinessPlan, IntakeQuestion } from "@/lib/questions";

export type DtiBusinessNameForm = {
  applicationType: "New registration";
  status: "Draft" | "Ready to submit" | "Submitted";
  /** Optional only so persisted pre-DX conversation messages remain renderable. */
  dominantName?: string;
  descriptorId?: string;
  descriptorLabel?: string;
  proposedName: string;
  businessActivity: string;
  territorialScope: "Barangay" | "City / municipality" | "Regional" | "National";
  territorialScopeId?: "CITY_MUNICIPALITY" | "REGIONAL" | "NATIONAL";
  ownerName: string;
  businessAddress: string;
  businessAddressDetails?: {
    source: "EGOV_RESIDENTIAL" | "USER_PROVIDED";
    addressLine1: string;
    addressLine2?: string;
    barangay: string;
    cityMunicipality: string;
    province: string;
    region: string;
    postalCode: string;
  };
  city: string;
  feeLabel: string;
  termsAndConditions?: string;
  businessNameRequirements?: readonly string[];
  termsAccepted?: boolean;
  missingFields: string[];
};

export type PaymentServiceType =
  | "dti-business-name"
  | "lgu-business-permit"
  | "bir-documentary-stamp-tax";

export type AskUserAnswer = { questionId: string; value: string | string[]; labels: string[] };
export type AskUserInput = { questions: IntakeQuestion[]; question?: IntakeQuestion };
export type AskUserOutput = {
  answers: AskUserAnswer[];
  value?: string | string[];
  labels?: string[];
};
export type WebSearchInput = { query: string; numResults?: number };
export type WebSearchOutput = { results: { title: string; url: string }[] };
export type EditDtiInput = {
  applicationId?: string;
  form?: DtiBusinessNameForm;
  note: string;
};
export type EditDtiOutput = {
  applicationId: string;
  form?: DtiBusinessNameForm;
};
export type LguPermitSummary = {
  applicationId: string;
  state: "PAYMENT_READY" | "PAYMENT_PENDING" | "COMPLETED";
  businessName: string;
  city: string;
  feeLabel: string;
  paymentStatus: "PENDING" | "PAID" | null;
  businessPermitNumber: string | null;
  barangayClearanceNumber: string | null;
  validUntil: string | null;
};
export type PrepareLguBusinessPermitOutput = { permit: LguPermitSummary };
export type IssueLguBusinessPermitOutput = { permit: LguPermitSummary };
export type PrepareSelfEmployedRegistrationOutput = {
  registrationType: "Self-employed";
  taxpayerName: string;
  professionalActivity: string;
  businessCity: string;
  rdo: string;
  addressSource: "Business address" | "Authenticated profile";
  status: "Ready for BIR form preparation";
  nextAction: string;
};
export type AgentPlanStep = {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  optional?: boolean;
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
  source: "BIR tool input merged with authenticated eGov SSO profile";
};
export type FinalizeBusinessRegistrationOutput = {
  businessId: string;
  businessName: string;
  certificateOfRegistrationFileId: string;
  registrationNumber: string;
  status: "Active";
};

export type BusinessChatTools = {
  user_info: { input: Record<string, never>; output: UserInfoOutput };
  generate_bir_form: { input: GenerateBirFormInput; output: GenerateBirFormOutput };
  send_sms_message: { input: SendSmsMessageInput; output: SendSmsMessageOutput };
  simulate_tax_payment_reminder: {
    input: SimulateTaxPaymentReminderInput;
    output: SimulateTaxPaymentReminderOutput;
  };
  askUser: { input: AskUserInput; output: AskUserOutput };
  webSearch: { input: WebSearchInput; output: WebSearchOutput };
  editDtiBusinessNameForm: { input: EditDtiInput; output: EditDtiOutput };
  prepareSelfEmployedRegistration: {
    input: Record<string, never>;
    output: PrepareSelfEmployedRegistrationOutput;
  };
  prepareLguBusinessPermit: {
    input: Record<string, never>;
    output: PrepareLguBusinessPermitOutput;
  };
  issueLguBusinessPermit: {
    input: Record<string, never>;
    output: IssueLguBusinessPermitOutput;
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
  registrationCompleted: { status: "complete" };
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

const OPTIONAL_REGISTRATION_STEP_IDS = new Set(["tax-compliance", "sector-permits", "employer"]);

export function isOptionalRegistrationStep(step: Pick<AgentPlanStep, "id" | "optional">) {
  return step.optional === true || OPTIONAL_REGISTRATION_STEP_IDS.has(step.id);
}

// Progress covers required registration checkpoints only. Optional follow-up
// work stays visible in the plan without preventing its completion state.
export type PlanProgress = { completed: number; total: number; done: boolean };

export type ConversationPurpose = "registration" | "management";

export type ConversationSummary = {
  id: string;
  title: string;
  initialPrompt: string;
  purpose: ConversationPurpose;
  businessId: string | null;
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
  const required = plan.steps.filter((step) => !isOptionalRegistrationStep(step));
  const resolved = required.filter(
    (step) => step.status === "completed" || step.status === "skipped",
  ).length;
  return {
    completed: resolved,
    done: required.length > 0 && resolved === required.length,
    total: required.length,
  };
}
