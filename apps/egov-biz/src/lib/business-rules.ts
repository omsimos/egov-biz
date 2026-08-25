export type BusinessCategory =
  | "professional-services"
  | "retail"
  | "food-service"
  | "food-manufacturing"
  | "vehicle-rental"
  | "general-services";

export type RegulatoryFlag =
  | "food"
  | "food-manufacturing"
  | "physical-premises"
  | "vehicles"
  | "employees";

export type AgencyCheck = {
  id: string;
  agency: string;
  title: string;
  description: string;
  appliesWhen: RegulatoryFlag;
  note?: string;
  citationIds: string[];
};

export const agencyChecks: AgencyCheck[] = [
  {
    id: "sanitary",
    agency: "City or municipal health office",
    title: "Get a sanitary permit",
    description: "Required for many businesses that prepare, handle, or serve food.",
    appliesWhen: "food",
    citationIds: [],
  },
  {
    id: "fda",
    agency: "FDA Philippines",
    title: "Check FDA requirements",
    description:
      "Packaged or manufactured food may need a License to Operate and product registration.",
    appliesWhen: "food-manufacturing",
    note: "The exact FDA requirement depends on how the product is made, packed, and sold.",
    citationIds: ["fda-food-lto"],
  },
  {
    id: "fire",
    agency: "Bureau of Fire Protection",
    title: "Get a fire safety certificate",
    description:
      "Business permit applications for physical premises commonly require fire safety inspection.",
    appliesWhen: "physical-premises",
    citationIds: ["bfp-fsic"],
  },
  {
    id: "lto",
    agency: "Land Transportation Office",
    title: "Check vehicle records",
    description: "Each rental vehicle needs valid registration and appropriate records.",
    appliesWhen: "vehicles",
    note: "Operating with drivers or transporting passengers may require additional LTFRB review; self-drive rental is different.",
    citationIds: [],
  },
  {
    id: "employers",
    agency: "SSS, PhilHealth, and Pag-IBIG",
    title: "Register as an employer",
    description: "Register and report employees with the required social agencies.",
    appliesWhen: "employees",
    citationIds: ["dti-registration"],
  },
];

/** What a prompt says the business is, and the regulatory follow-ups it triggers. */
export type InferredBusinessCategory = {
  category: BusinessCategory;
  flags: RegulatoryFlag[];
};

export function inferCategory(prompt: string): InferredBusinessCategory {
  const value = prompt.toLowerCase();
  if (/car rental|vehicle rental|rent.*car|rent.*vehicle/.test(value)) {
    return { category: "vehicle-rental", flags: ["vehicles"] };
  }
  if (/coffee|food|meal|bake|bakery|cake|catering|restaurant|snack|drink|beverage/.test(value)) {
    const manufacturing = /pack|bottle|manufactur|process|subscription/.test(value);
    return {
      category: manufacturing ? "food-manufacturing" : "food-service",
      flags: manufacturing ? ["food", "food-manufacturing"] : ["food"],
    };
  }
  if (
    /freelanc(?:e|er|ing)|virtual assistant|\bva\b|consult|designer|developer|writer|accountant|photograph|professional|dentist|dental|doctor|physician|architect|lawyer|clinic/.test(
      value,
    )
  ) {
    return {
      category: "professional-services",
      flags: /clinic|dental|dentist|doctor|physician/.test(value) ? ["physical-premises"] : [],
    };
  }
  if (/shop|store|sell|retail|product/.test(value)) {
    return { category: "retail", flags: [] };
  }
  return { category: "general-services", flags: [] };
}

export function fallbackQuestionFor(prompt: string, answerCount: number) {
  const { category } = inferCategory(prompt);
  if (answerCount === 0) {
    if (category === "vehicle-rental") {
      return {
        id: "rental-operation",
        eyebrow: "One detail",
        title: "How will customers use the vehicles?",
        helpText: "Choose the main service.",
        type: "single" as const,
        options: [
          {
            id: "self-drive",
            label: "Self-drive rental",
            description: "Customers drive the vehicle",
            icon: "store" as const,
          },
          {
            id: "with-driver",
            label: "Rental with a driver",
            description: "You provide the driver",
            icon: "pin" as const,
          },
        ],
      };
    }
    if (category === "food-manufacturing" || category === "food-service") {
      return {
        id: "food-preparation",
        eyebrow: "One detail",
        title: "Where will you prepare the food or drinks?",
        helpText: "This affects health and local permits.",
        type: "single" as const,
        options: [
          { id: "home", label: "At home", icon: "home" as const },
          { id: "commercial", label: "Commercial kitchen or shop", icon: "store" as const },
          { id: "supplier", label: "A supplier makes it", icon: "coffee" as const },
        ],
      };
    }
    return {
      id: "work-location",
      eyebrow: "One detail",
      title: "Where will you work?",
      helpText: "Choose the main location.",
      type: "single" as const,
      options: [
        { id: "home", label: "From home", icon: "home" as const },
        { id: "online", label: "Online", icon: "laptop" as const },
        { id: "premises", label: "Office or shop", icon: "store" as const },
      ],
    };
  }
  return {
    id: "workers",
    eyebrow: "Last detail",
    title: "Will you hire anyone?",
    helpText: "Do not include yourself.",
    type: "single" as const,
    options: [
      { id: "none", label: "No employees", icon: "store" as const },
      { id: "yes", label: "Yes", icon: "store" as const },
    ],
  };
}
