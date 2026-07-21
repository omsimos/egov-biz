import type { DtiBusinessNameForm } from "@/lib/business-chat";

const fees = {
  Barangay: 230,
  "City / municipality": 530,
  Regional: 1030,
  National: 2030,
} as const;

export function dtiRegistrationFee(scope: DtiBusinessNameForm["territorialScope"]) {
  return fees[scope];
}

export function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(amount);
}
