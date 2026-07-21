import { describe, expect, test } from "bun:test";
import type { RegistrationPlan } from "@/lib/business-chat";
import { completeRegistrationPlan, normalizeRegistrationPlan } from "@/lib/registration-plan";

describe("normalizeRegistrationPlan", () => {
  test("marks untouched requirements before a later active checkpoint as skipped", () => {
    const plan: RegistrationPlan = {
      title: "Registration",
      steps: [
        { id: "details", label: "Details", status: "completed" },
        { id: "name", label: "Name registration", status: "pending" },
        { id: "permit", label: "Business permit", status: "pending" },
        { id: "bir", label: "BIR registration", status: "in_progress" },
        { id: "filing", label: "Tax filing", status: "pending" },
      ],
    };

    expect(normalizeRegistrationPlan(plan).steps.map((step) => step.status)).toEqual([
      "completed",
      "skipped",
      "skipped",
      "in_progress",
      "pending",
    ]);
  });

  test("keeps completed and explicitly skipped checkpoints unchanged", () => {
    const plan: RegistrationPlan = {
      title: "Registration",
      steps: [
        { id: "details", label: "Details", status: "completed" },
        { id: "name", label: "Name registration", status: "skipped" },
        { id: "bir", label: "BIR registration", status: "in_progress" },
      ],
    };

    expect(normalizeRegistrationPlan(plan)).toEqual(plan);
  });

  test("does not turn explicitly inapplicable self-employed steps into completed steps", () => {
    const result = completeRegistrationPlan(
      {
        title: "Self-employed registration",
        steps: [
          { id: "name-registration", label: "DTI", status: "skipped" },
          { id: "business-permit", label: "Business permit", status: "skipped" },
          { id: "bir", label: "BIR", status: "completed" },
          { id: "tax-compliance", label: "Tax setup", status: "in_progress" },
        ],
      },
      { employer: false, sectorPermits: false },
    );

    expect(result.steps.map((step) => step.status)).toEqual([
      "skipped",
      "skipped",
      "completed",
      "completed",
    ]);
  });
});

describe("completeRegistrationPlan", () => {
  test("completes applicable requirements and skips requirements that do not apply", () => {
    const result = completeRegistrationPlan(
      {
        title: "Registration",
        steps: [
          { id: "bir", label: "BIR", status: "in_progress" },
          { id: "sector-permits", label: "Sector permits", status: "pending" },
          { id: "employer", label: "Employer registration", status: "pending" },
          { id: "launch-renewals", label: "Renewals", status: "pending" },
        ],
      },
      { employer: false, sectorPermits: true },
    );

    expect(result.steps.map((step) => step.status)).toEqual([
      "completed",
      "completed",
      "skipped",
      "completed",
    ]);
  });
});
