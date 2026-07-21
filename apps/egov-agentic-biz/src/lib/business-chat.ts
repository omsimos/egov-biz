import type { UIMessage } from "ai";
import type { BirFormArtifact } from "@/lib/bir-form/artifact";
import type { CitizenProfile } from "@/lib/citizen-profile";
import type { BusinessPlan, IntakeQuestion } from "@/lib/questions";

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

export type AskUserInput = { question: IntakeQuestion };
export type AskUserOutput = { value: string | string[]; labels: string[] };
export type WebSearchInput = { query: string; numResults?: number };
export type WebSearchOutput = { results: { title: string; url: string }[] };
export type EditDtiInput = { form: DtiBusinessNameForm; note: string };
export type EditDtiOutput = { form: DtiBusinessNameForm };
export type AgentPlanStep = {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed";
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
  updatePlan: { input: UpdatePlanInput; output: UpdatePlanOutput };
};

export type BusinessChatData = {
  plan: { plan: BusinessPlan };
};

export type BusinessChatMessage = UIMessage<unknown, BusinessChatData, BusinessChatTools>;

export type BusinessChatContext = {
  profile: CitizenProfile | null;
  initialPrompt: string;
};
