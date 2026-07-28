import type { BnrsBusinessScope, BnrsDescriptor } from "./types.js";

export const BNRS_TERMS_AND_CONDITIONS =
  "By continuing, you confirm that the information submitted for this sole-proprietorship business-name application is accurate. Your proposed business name must not be unlawful, misleading, purely generic, restricted by law, reserved for government use, or confusingly similar to a registered name or mark. Application information may be processed for business-name registration and related government services. Registration details become final when payment begins, and registration is completed only after payment is verified.";

export const BNRS_BUSINESS_NAME_REMINDERS = Object.freeze([
  "The proposed name must not suggest unlawful, immoral, scandalous, or improper activity.",
  "The proposed name must not misrepresent the nature or quality of the business.",
  "The proposed name must not conflict with a registered trade name, trademark, or business name.",
  "The proposed name must not be inimical to the security of the State.",
  "The dominant name must not be purely generic.",
  "The proposed name must not use words or names restricted by law or regulation.",
  "The proposed name must not imply an official government function or affiliation.",
  "A nation or intergovernmental organization name or abbreviation requires authorization.",
  "The proposed name must not be prohibited by a court or administrative order.",
  "The proposed name must not improperly use another person's name.",
  "The applicant remains responsible for the legality and accuracy of the proposed name.",
] as const);

export const BNRS_DESCRIPTORS = Object.freeze([
  { id: "SARI_SARI_STORE", label: "SARI-SARI STORE" },
  { id: "GROCERY_STORE", label: "GROCERY STORE" },
  { id: "CONVENIENCE_STORE", label: "CONVENIENCE STORE" },
  { id: "ONLINE_SHOP", label: "ONLINE SHOP" },
  { id: "PHARMACY", label: "PHARMACY" },
  { id: "DENTAL_CLINIC", label: "DENTAL CLINIC" },
  { id: "MEDICAL_CLINIC", label: "MEDICAL CLINIC" },
  { id: "OPTICAL_CLINIC", label: "OPTICAL CLINIC" },
  { id: "BEAUTY_SALON", label: "BEAUTY SALON" },
  { id: "BARBER_SHOP", label: "BARBER SHOP" },
  { id: "LAUNDRY_SHOP", label: "LAUNDRY SHOP" },
  { id: "TAILORING_SHOP", label: "TAILORING SHOP" },
  { id: "COFFEE_SHOP", label: "COFFEE SHOP" },
  { id: "RESTAURANT", label: "RESTAURANT" },
  { id: "BAKESHOP", label: "BAKESHOP" },
  { id: "CARINDERIA", label: "CARINDERIA" },
  { id: "CATERING_SERVICES", label: "CATERING SERVICES" },
  { id: "FOOD_SERVICES", label: "FOOD SERVICES" },
  { id: "WATER_REFILLING_STATION", label: "WATER REFILLING STATION" },
  { id: "HARDWARE_CONSTRUCTION_SUPPLIES", label: "HARDWARE & CONSTRUCTION SUPPLIES" },
  { id: "CONSTRUCTION_SERVICES", label: "CONSTRUCTION SERVICES" },
  { id: "PLUMBING_SERVICES", label: "PLUMBING SERVICES" },
  { id: "ELECTRICAL_SERVICES", label: "ELECTRICAL SERVICES" },
  { id: "AUTO_REPAIR_SHOP", label: "AUTO REPAIR SHOP" },
  { id: "MOTORCYCLE_REPAIR_SHOP", label: "MOTORCYCLE REPAIR SHOP" },
  { id: "PRINTING_SERVICES", label: "PRINTING SERVICES" },
  { id: "PHOTOGRAPHY_SERVICES", label: "PHOTOGRAPHY SERVICES" },
  { id: "ACCOUNTING_SERVICES", label: "ACCOUNTING SERVICES" },
  { id: "MANAGEMENT_CONSULTANCY_SERVICES", label: "MANAGEMENT CONSULTANCY SERVICES" },
  { id: "BUSINESS_CONSULTANCY_SERVICES", label: "BUSINESS CONSULTANCY SERVICES" },
  { id: "REAL_ESTATE_BROKERAGE", label: "REAL ESTATE BROKERAGE" },
  { id: "TRAVEL_AND_TOURS", label: "TRAVEL AND TOURS" },
  { id: "DELIVERY_SERVICES", label: "DELIVERY SERVICES" },
  { id: "AGRICULTURAL_PRODUCTS_TRADING", label: "AGRICULTURAL PRODUCTS TRADING" },
  { id: "COMPUTER_SOFTWARE_STORE", label: "COMPUTER SOFTWARE STORE" },
  { id: "SOFTWARE_DEVELOPMENT_SERVICES", label: "SOFTWARE DEVELOPMENT SERVICES" },
  { id: "I_T_SOLUTIONS", label: "I.T. SOLUTIONS" },
  { id: "INFORMATION_TECHNOLOGY_SERVICES", label: "INFORMATION TECHNOLOGY SERVICES" },
  { id: "MARKETING_CONSULTANCY_SERVICES", label: "MARKETING CONSULTANCY SERVICES" },
  { id: "SECURITY_SERVICES", label: "SECURITY SERVICES" },
] as const satisfies readonly BnrsDescriptor[]);

export type BnrsDescriptorId = (typeof BNRS_DESCRIPTORS)[number]["id"];

const DOCUMENTARY_STAMP_TAX = 30;

export const BNRS_BUSINESS_SCOPES = Object.freeze([
  {
    id: "CITY_MUNICIPALITY",
    label: "City/Municipality",
    registrationFee: 500,
    documentaryStampTax: DOCUMENTARY_STAMP_TAX,
    totalFee: 530,
  },
  {
    id: "REGIONAL",
    label: "Regional",
    registrationFee: 1_000,
    documentaryStampTax: DOCUMENTARY_STAMP_TAX,
    totalFee: 1_030,
  },
  {
    id: "NATIONAL",
    label: "National",
    registrationFee: 2_000,
    documentaryStampTax: DOCUMENTARY_STAMP_TAX,
    totalFee: 2_030,
  },
] as const satisfies readonly BnrsBusinessScope[]);

export function getBusinessNameRequirements() {
  return {
    descriptors: BNRS_DESCRIPTORS,
    reminders: BNRS_BUSINESS_NAME_REMINDERS,
  } as const;
}

export function getBusinessScopes() {
  return BNRS_BUSINESS_SCOPES;
}
