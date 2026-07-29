import { describe, expect, test } from "bun:test";
import type { BusinessChatMessage, DtiBusinessNameForm } from "@/lib/business-chat";
import { latestReadyDtiBusinessNameForm } from "@/lib/dti-form";

const readyForm: DtiBusinessNameForm = {
  applicationType: "New registration",
  status: "Ready to submit",
  proposedName: "Kape Diaria",
  businessActivity: "Coffee subscription boxes",
  territorialScope: "City / municipality",
  ownerName: "Juan Dela Cruz",
  businessAddress: "Unit 2, 88 Ayala Avenue, Barangay San Lorenzo",
  businessAddressSource: "egov-residential",
  city: "Makati City",
  feeLabel: "₱530.00",
  missingFields: [],
};

function messagesWithForms(...forms: DtiBusinessNameForm[]) {
  return [
    {
      id: "assistant-message",
      role: "assistant",
      parts: forms.map((form, index) => ({
        type: "tool-editDtiBusinessNameForm",
        state: "output-available",
        toolCallId: `tool-${index}`,
        input: { form, note: "Prepared" },
        output: { form },
      })),
    },
  ] as unknown as BusinessChatMessage[];
}

describe("latestReadyDtiBusinessNameForm", () => {
  test("returns the latest server-recorded form only when its address is confirmed", () => {
    expect(latestReadyDtiBusinessNameForm(messagesWithForms(readyForm))).toEqual(readyForm);
  });

  test("rejects a form without address confirmation", () => {
    const unconfirmed = { ...readyForm, businessAddressSource: null };
    expect(latestReadyDtiBusinessNameForm(messagesWithForms(unconfirmed))).toBeNull();
  });

  test("rejects an incomplete address", () => {
    const incomplete = { ...readyForm, businessAddress: "Unit 2 Main Building" };
    expect(latestReadyDtiBusinessNameForm(messagesWithForms(incomplete))).toBeNull();
  });

  test("does not fall back to an older ready form when the latest form is invalid", () => {
    const latest = { ...readyForm, businessAddressSource: null };
    expect(latestReadyDtiBusinessNameForm(messagesWithForms(readyForm, latest))).toBeNull();
  });
});
