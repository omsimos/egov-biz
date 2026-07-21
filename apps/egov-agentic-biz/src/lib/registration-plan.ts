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

export function normalizeRegistrationPlan(plan: RegistrationPlan): RegistrationPlan {
  let foundActive = false;
  const steps = plan.steps.map((step) => {
    if (step.status !== "in_progress") return step;
    if (foundActive) return { ...step, status: "pending" as const };
    foundActive = true;
    return step;
  });
  const activeIndex = steps.findIndex((step) => step.status === "in_progress");

  return {
    title: plan.title,
    steps: steps.map((step, index) =>
      activeIndex > index && step.status === "pending"
        ? { ...step, status: "skipped" as const }
        : step,
    ),
  };
}

export function completeRegistrationPlan(
  plan: RegistrationPlan,
  applicability: { employer: boolean; sectorPermits: boolean },
): RegistrationPlan {
  return {
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      status:
        step.status === "skipped" ||
        (step.id === "employer" && !applicability.employer) ||
        (step.id === "sector-permits" && !applicability.sectorPermits)
          ? ("skipped" as const)
          : ("completed" as const),
    })),
  };
}
