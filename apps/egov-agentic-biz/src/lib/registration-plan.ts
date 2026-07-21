import type { RegistrationPlan } from "@/lib/business-chat";

export const initialRegistrationPlan: RegistrationPlan = {
  title: "Business name registration",
  steps: [
    { id: "details", label: "Confirm registration details", status: "in_progress" },
    { id: "official-check", label: "Check official DTI guidance", status: "pending" },
    { id: "application", label: "Prepare the DTI application", status: "pending" },
    { id: "payment", label: "Submit and pay through eGovPay", status: "pending" },
  ],
};
