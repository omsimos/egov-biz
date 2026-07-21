import type { BusinessCategory, RegulatoryFlag } from "@/lib/business-rules";
import type { BusinessPlan, PlanCitation, RdoSelection } from "@/lib/questions";

export type ResolvedLocation = {
  city: string;
  source: "prompt" | "answer" | "profile";
  rdos: RdoSelection[];
};

const BIR_DIRECTORY_URL = "https://web-services.bir.gov.ph/trraportal/";

export const officialSources: Record<string, PlanCitation> = {
  dti: {
    id: "dti-registration",
    title: "Business Registration and Permits",
    agency: "DTI",
    url: "https://www.dti.gov.ph/dti-business-center/dti-business-registration-permits",
    note: "DTI registers sole proprietorship business names; partnerships and corporations register with SEC.",
  },
  bir: {
    id: "bir-newbizreg",
    title: "New Business Registration",
    agency: "BIR",
    url: "https://web-services.bir.gov.ph/newbizreg/",
    note: "BIR routes registration to the RDO for the business address, or residence for a professional without a physical business address.",
  },
  rdo: {
    id: "bir-rdo-directory",
    title: "BIR Revenue District directory",
    agency: "BIR",
    url: BIR_DIRECTORY_URL,
    note: "Official list of Revenue District Offices.",
  },
  fda: {
    id: "fda-food-lto",
    title: "License to Operate",
    agency: "FDA Philippines",
    url: "https://www.fda.gov.ph/citizen-charter-cfrr-2025/",
    note: "Food manufacturers and some food traders or distributors may need FDA licensing.",
  },
  bfp: {
    id: "bfp-fsic",
    title: "Fire Safety Enforcement forms",
    agency: "Bureau of Fire Protection",
    url: "https://bfp.gov.ph/fsed-forms/",
    note: "BFP provides the Fire Safety Inspection Certificate used for new business permits.",
  },
};

const cityCatalog = [
  {
    city: "Makati City",
    aliases: ["makati", "makati city"],
    rdos: [
      ["047", "East Makati"],
      ["048", "West Makati"],
      ["049", "North Makati"],
      ["050", "South Makati"],
    ],
  },
  {
    city: "Iloilo City",
    aliases: ["iloilo", "iloilo city", "iluilo", "iluilo city"],
    rdos: [["074", "Iloilo City"]],
  },
  {
    city: "Cebu City",
    aliases: ["cebu", "cebu city"],
    rdos: [
      ["081", "Cebu City North"],
      ["082", "Cebu City South"],
    ],
  },
  {
    city: "Mandaue City",
    aliases: ["mandaue", "mandaue city"],
    rdos: [["080", "Mandaue City"]],
  },
  {
    city: "Pasig City",
    aliases: ["pasig", "pasig city"],
    rdos: [["043", "Pasig City"]],
  },
] as const;

function toRdo([code, name]: readonly [string, string], exact: boolean): RdoSelection {
  return {
    code,
    name: `RDO ${Number(code)} — ${name}`,
    status: exact ? "exact" : "needs-confirmation",
    citationIds: ["bir-rdo-directory"],
  };
}

export function extractAnsweredLocation(answers: { questionId: string; labels: string[] }[]) {
  const locationAnswer = answers.find((answer) => /city|location|address|barangay/i.test(answer.questionId));
  return locationAnswer?.labels.join(" ");
}

export function resolveBusinessLocation(prompt: string, profileCity: string, answers: { questionId: string; labels: string[] }[]): ResolvedLocation {
  const answered = extractAnsweredLocation(answers);
  const candidates = [
    { value: prompt, source: "prompt" as const },
    { value: answered ?? "", source: "answer" as const },
    { value: profileCity, source: "profile" as const },
  ];

  for (const candidate of candidates) {
    const normalized = candidate.value.toLowerCase();
    const match = cityCatalog.find((entry) => entry.aliases.some((alias) => new RegExp(`\\b${alias.replace(" ", "\\s+")}\\b`, "i").test(normalized)));
    if (match) {
      return {
        city: match.city,
        source: candidate.source,
        rdos: match.rdos.map((rdo) => toRdo(rdo, match.rdos.length === 1)),
      };
    }
  }

  const explicitUnknownCity = prompt.match(/\b(?:in|at|from|near)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2}\s+City)\b/i)?.[1];
  if (explicitUnknownCity) {
    return {
      city: explicitUnknownCity.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      source: "prompt",
      rdos: [],
    };
  }

  return { city: profileCity || "Philippines", source: "profile", rdos: [] };
}

export function locationQuestion(city: string, rdos: RdoSelection[]) {
  return {
    id: "business-area",
    eyebrow: "One location detail",
    title: `Which part of ${city}?`,
    helpText: "This helps find the correct BIR office.",
    type: "single" as const,
    options: rdos.map((rdo) => ({ id: rdo.code, label: rdo.name.replace(/^RDO \d+ — /, ""), description: `RDO ${Number(rdo.code)}`, icon: "pin" as const })),
  };
}

export function selectRdo(location: ResolvedLocation, answers: { questionId: string; value: string | string[] }[], addressContext = "") {
  if (location.rdos.length === 1) return location.rdos[0];
  const selection = answers.find((answer) => answer.questionId === "business-area")?.value;
  const value = Array.isArray(selection) ? selection[0] : selection;
  const selected = location.rdos.find((rdo) => rdo.code === value);
  if (selected) return { ...selected, status: "exact" as const };
  if (location.city === "Makati City" && /poblacion/i.test(addressContext)) {
    const poblacionRdo = location.rdos.find((rdo) => rdo.code === "049");
    return poblacionRdo ? { ...poblacionRdo, status: "exact" as const } : null;
  }
  return null;
}

export function citationsForPlan(registrationType: BusinessPlan["registrationType"], flags: RegulatoryFlag[]) {
  const ids = new Set<string>(["bir", "rdo"]);
  if (registrationType !== "Self-employed") ids.add("dti");
  if (flags.includes("food-manufacturing")) ids.add("fda");
  if (flags.includes("physical-premises")) ids.add("bfp");
  return [...ids].map((id) => officialSources[id]);
}

export function buildRationale(type: BusinessPlan["registrationType"], category: BusinessCategory, city: string, rdo: RdoSelection | null, flags: RegulatoryFlag[], existingRdo?: string) {
  const reasons: BusinessPlan["rationale"] = [];
  if (type === "Self-employed") reasons.push({ text: "You described independent professional work, so the shortest path is individual self-employed registration.", citationIds: ["bir-newbizreg"] });
  else if (type === "Company") reasons.push({ text: "You described shared ownership, so SEC registration comes before local and tax registration.", citationIds: ["dti-registration"] });
  else reasons.push({ text: "You are selling goods or services as one owner, so the plan starts with a sole proprietorship.", citationIds: ["dti-registration"] });
  reasons.push({ text: `Local permits are based on the business location in ${city}.`, citationIds: ["dti-registration"] });
  if (rdo) reasons.push({ text: `${rdo.name} covers the selected business area; BIR uses the business address, or a professional’s residence when there is no separate workplace.`, citationIds: ["bir-newbizreg", "bir-rdo-directory"] });
  if (rdo && existingRdo && !existingRdo.includes(String(Number(rdo.code)))) reasons.push({ text: `Your existing record shows ${existingRdo}. Because this business uses a different jurisdiction, BIR should confirm whether an update is needed.`, citationIds: ["bir-newbizreg"] });
  if (flags.includes("food-manufacturing")) reasons.push({ text: "Packaged or processed food may also need FDA review.", citationIds: ["fda-food-lto"] });
  if (flags.includes("physical-premises")) reasons.push({ text: "A physical workplace can add fire-safety and local permit checks.", citationIds: ["bfp-fsic"] });
  return reasons.slice(0, 4);
}
