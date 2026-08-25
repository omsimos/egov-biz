import { payloadText, type PayloadValue } from "@/lib/payload";

type DescriptorOption = { id: string; label: string };

const DESCRIPTOR_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bsari[- ]sari\b/i, "SARI_SARI_STORE"],
  [/\b(?:grocery|groceries)\b/i, "GROCERY_STORE"],
  [/\bconvenience store\b/i, "CONVENIENCE_STORE"],
  [/\b(?:pharmacy|drugstore)\b/i, "PHARMACY"],
  [/\bdental\b/i, "DENTAL_CLINIC"],
  [/\b(?:medical clinic|doctor|physician)\b/i, "MEDICAL_CLINIC"],
  [/\boptical\b/i, "OPTICAL_CLINIC"],
  [/\b(?:beauty salon|beautician)\b/i, "BEAUTY_SALON"],
  [/\bbarber\b/i, "BARBER_SHOP"],
  [/\blaundry\b/i, "LAUNDRY_SHOP"],
  [/\b(?:tailor|tailoring)\b/i, "TAILORING_SHOP"],
  [/\bcoffee\b/i, "COFFEE_SHOP"],
  [/\brestaurant\b/i, "RESTAURANT"],
  [/\b(?:bakery|bakeshop|bread|cake)\b/i, "BAKESHOP"],
  [/\bcarinderia\b/i, "CARINDERIA"],
  [/\bcater(?:ing)?\b/i, "CATERING_SERVICES"],
  [/\bwater refill/i, "WATER_REFILLING_STATION"],
  [/\bhardware\b/i, "HARDWARE_CONSTRUCTION_SUPPLIES"],
  [/\bplumb(?:er|ing)\b/i, "PLUMBING_SERVICES"],
  [/\belectric(?:al|ian)\b/i, "ELECTRICAL_SERVICES"],
  [/\bmotorcycle repair\b/i, "MOTORCYCLE_REPAIR_SHOP"],
  [/\b(?:auto|car|vehicle) repair\b/i, "AUTO_REPAIR_SHOP"],
  [/\bprint(?:ing)?\b/i, "PRINTING_SERVICES"],
  [/\bphotograph(?:y|er)\b/i, "PHOTOGRAPHY_SERVICES"],
  [/\baccount(?:ing|ant)\b/i, "ACCOUNTING_SERVICES"],
  [/\bmanagement consult/i, "MANAGEMENT_CONSULTANCY_SERVICES"],
  [/\bbusiness consult/i, "BUSINESS_CONSULTANCY_SERVICES"],
  [/\breal estate\b/i, "REAL_ESTATE_BROKERAGE"],
  [/\btravel|tours?\b/i, "TRAVEL_AND_TOURS"],
  [/\bdeliver(?:y|ies)\b/i, "DELIVERY_SERVICES"],
  [/\bagricultur/i, "AGRICULTURAL_PRODUCTS_TRADING"],
  [/\bsoftware development\b/i, "SOFTWARE_DEVELOPMENT_SERVICES"],
  [/\b(?:i\.?t\.? solutions?|information technology)\b/i, "INFORMATION_TECHNOLOGY_SERVICES"],
  [/\bmarketing consult/i, "MARKETING_CONSULTANCY_SERVICES"],
  [/\bsecurity service/i, "SECURITY_SERVICES"],
  [/\bonline|e-?commerce|social media (?:shop|store)|web(?:site)? shop\b/i, "ONLINE_SHOP"],
];

export function validBnrsDescriptorSuggestion(
  value: PayloadValue,
  descriptors: readonly DescriptorOption[],
): string | null {
  const id = payloadText(value).trim();
  return descriptors.some((descriptor) => descriptor.id === id) ? id : null;
}

export function orderBnrsDescriptorsWithSuggestionFirst<T extends DescriptorOption>(
  descriptors: readonly T[],
  suggestedDescriptorId: PayloadValue,
): T[] {
  const suggestion = validBnrsDescriptorSuggestion(suggestedDescriptorId, descriptors);
  if (!suggestion) return [...descriptors];

  return [
    ...descriptors.filter((descriptor) => descriptor.id === suggestion),
    ...descriptors.filter((descriptor) => descriptor.id !== suggestion),
  ];
}

export function fallbackBnrsDescriptorSuggestion(
  conversation: string,
  descriptors: readonly DescriptorOption[],
): string | null {
  for (const [pattern, id] of DESCRIPTOR_PATTERNS) {
    if (pattern.test(conversation)) return validBnrsDescriptorSuggestion(id, descriptors);
  }
  return null;
}
