export type QuestionOption = {
  id: string;
  label: string;
  description?: string;
  icon?: "store" | "laptop" | "coffee" | "home" | "pin" | "calendar";
};

export type PlanReason = {
  text: string;
  citationIds: string[];
};

export type BusinessPlan = {
  businessLabel: string;
  registrationType: "Sole proprietor" | "Self-employed" | "Company" | "Needs review";
  city: string;
  setup: string[];
  people: number;
  category: "professional-services" | "retail" | "food-service" | "food-manufacturing" | "vehicle-rental" | "general-services";
  flags: ("food" | "food-manufacturing" | "physical-premises" | "vehicles" | "employees")[];
  rdo: RdoSelection | null;
  rationale: PlanReason[];
  citations: PlanCitation[];
};

export type RdoSelection = {
  code: string;
  name: string;
  status: "exact" | "needs-confirmation";
  citationIds: string[];
};

export type PlanCitation = {
  id: string;
  title: string;
  agency: string;
  url: string;
  note: string;
};

export type IntakeAnswer = {
  toolCallId?: string;
  questionId: string;
  question: string;
  value: string | string[];
  labels: string[];
};

export type IntakeQuestion = {
  id: string;
  eyebrow: string;
  title: string;
  helpText: string;
  type: "single" | "multi" | "number" | "text";
  options?: QuestionOption[];
  placeholder?: string;
  suffix?: string;
  minimum?: number;
  maximum?: number;
};

export const deterministicQuestions: IntakeQuestion[] = [
  {
    id: "business-type",
    eyebrow: "First",
    title: "What best describes what you’re starting?",
    helpText: "Choose the closest match.",
    type: "single",
    options: [
      { id: "sole", label: "A small business", description: "I’ll own and run it myself", icon: "store" },
      { id: "freelance", label: "Freelance work", description: "I provide services under my name", icon: "laptop" },
      { id: "corporation", label: "A company with partners", description: "A corporation or partnership", icon: "coffee" },
    ],
  },
  {
    id: "setup",
    eyebrow: "Next",
    title: "How will Poblacion Coffee Club operate?",
    helpText: "Choose all that apply.",
    type: "multi",
    options: [
      { id: "online", label: "Sell online", description: "Orders through a website or social media", icon: "laptop" },
      { id: "home", label: "Work from home", description: "Pack subscriptions at my home address", icon: "home" },
      { id: "storefront", label: "Open a physical shop", description: "Customers can visit a location", icon: "store" },
      { id: "delivery", label: "Deliver within Metro Manila", description: "Use couriers or deliver directly", icon: "pin" },
    ],
  },
  {
    id: "people",
    eyebrow: "Last question",
    title: "How many people will work in the business at launch?",
    helpText: "Include yourself.",
    type: "number",
    placeholder: "1",
    suffix: "person",
    minimum: 1,
    maximum: 100,
  },
];
