import type { RegistrationPlan } from "@/lib/business-chat";

export const initialRegistrationPlan: RegistrationPlan = {
  title: "End-to-end business registration",
  steps: [
    {
      id: "details",
      label: "Confirm business model, owners, location, and staffing",
      status: "in_progress",
    },
    {
      id: "structure",
      label: "Confirm legal structure and official registration route",
      status: "pending",
    },
    {
      id: "name-registration",
      label: "Register the business name with DTI or entity with SEC",
      status: "pending",
    },
    {
      id: "local-clearance",
      label: "Secure barangay clearance and location requirements",
      status: "pending",
    },
    {
      id: "business-permit",
      label: "Apply for the city or municipal business permit",
      status: "pending",
    },
    { id: "bir", label: "Register with BIR and the correct RDO", status: "pending" },
    {
      id: "tax-compliance",
      label: "Set up books, invoices, and recurring tax filings",
      status: "pending",
    },
    {
      id: "sector-permits",
      label: "Complete food, fire, sanitary, or sector permits",
      status: "pending",
    },
    {
      id: "employer",
      label: "Register with SSS, PhilHealth, and Pag-IBIG if hiring",
      status: "pending",
    },
    {
      id: "launch-renewals",
      label: "Launch, retain records, and schedule annual renewals",
      status: "pending",
    },
  ],
};
