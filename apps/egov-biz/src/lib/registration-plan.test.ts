import { describe, expect, test } from "bun:test";
import { planProgress, type RegistrationPlan } from "@/lib/business-chat";
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
    const result = completeRegistrationPlan({
      title: "Self-employed registration",
      steps: [
        { id: "name-registration", label: "DTI", status: "skipped" },
        { id: "business-permit", label: "Business permit", status: "skipped" },
        { id: "bir", label: "BIR", status: "completed" },
        { id: "tax-compliance", label: "Tax setup", status: "in_progress" },
      ],
    });

    expect(result.steps.map((step) => step.status)).toEqual([
      "skipped",
      "skipped",
      "completed",
      "pending",
    ]);
    expect(result.steps.at(-1)?.optional).toBe(true);
  });
});

describe("completeRegistrationPlan", () => {
  test("completes required checkpoints and leaves optional follow-ups open", () => {
    const result = completeRegistrationPlan({
      title: "Registration",
      steps: [
        { id: "bir", label: "BIR", status: "in_progress" },
        { id: "sector-permits", label: "Sector permits", status: "pending" },
        { id: "employer", label: "Employer registration", status: "pending" },
        { id: "launch-renewals", label: "Renewals", status: "pending" },
      ],
    });

    expect(result.steps.map((step) => step.status)).toEqual([
      "completed",
      "pending",
      "pending",
      "completed",
    ]);
    expect(planProgress(result)).toEqual({ completed: 2, done: true, nextLabel: null, total: 2 });
  });
});

describe("planProgress", () => {
  test("does not let optional steps block completion", () => {
    expect(
      planProgress({
        title: "Registration",
        steps: [
          { id: "bir", label: "BIR", status: "completed" },
          { id: "tax-compliance", label: "Books", status: "pending", optional: true },
          { id: "sector-permits", label: "Sector permits", status: "pending", optional: true },
          { id: "employer", label: "Employer", status: "pending", optional: true },
          { id: "launch-renewals", label: "Launch", status: "completed" },
        ],
      }),
    ).toEqual({ completed: 2, done: true, nextLabel: null, total: 2 });
  });
});
