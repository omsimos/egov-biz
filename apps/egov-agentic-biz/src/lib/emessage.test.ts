import { describe, expect, test } from "bun:test";
import type { EMessageClient, EMessageSmsRequest } from "@repo/egov/eMessage";
import {
  buildTaxPaymentReminderMessage,
  extractExplicitSmsMessage,
  extractSmsNumber,
  hasTaxObligationReference,
  isExplicitSmsSendRequest,
  isTaxPaymentReminderSimulationRequest,
  isTaxPaymentReminderRetryRequest,
  normalizeSmsNumber,
  selectTaxReminderObligation,
  sendSmsMessage,
  simulateTaxPaymentReminder,
  smsNumberMention,
} from "@/lib/emessage";
import type { TaxObligation } from "@/lib/registered-business";

function recordingClient(requests: EMessageSmsRequest[]): EMessageClient {
  return {
    async sendSms(request) {
      requests.push(request);
      return { data: { message: "SMS created successfully" } };
    },
  };
}

describe("eMessage chat tools", () => {
  test("normalizes Philippine mobile formats to E.164", () => {
    expect(normalizeSmsNumber("0917 123 4567")).toBe("+639171234567");
    expect(normalizeSmsNumber("917-123-4567")).toBe("+639171234567");
    expect(normalizeSmsNumber("63 917 123 4567")).toBe("+639171234567");
    expect(normalizeSmsNumber("0063 917 123 4567")).toBe("+639171234567");
    expect(() => normalizeSmsNumber("call me")).toThrow("valid E.164");
  });

  test("extracts a chat-supplied mobile number", () => {
    expect(extractSmsNumber("Send it to 0917 123 4567 please")).toBe("+639171234567");
    expect(extractSmsNumber("Use the number from my profile")).toBeUndefined();
    expect(smsNumberMention("Send it to 091712345678")).toEqual({
      kind: "invalid",
      value: "091712345678",
    });
    expect(extractSmsNumber("Send it to 091712345678")).toBeUndefined();
    expect(smsNumberMention("Send to 0917 111 1111; sorry, use 0947 222 2222 instead")).toEqual({
      kind: "ambiguous",
      values: ["0917 111 1111", "0947 222 2222"],
    });
    expect(smsNumberMention("Send to 0917 123 4567 or +63 917 123 4567")).toEqual({
      kind: "valid",
      number: "+639171234567",
      value: "+63 917 123 4567",
    });
    expect(smsNumberMention('Send an SMS that says "Your reference is 9171234567"')).toEqual({
      kind: "none",
    });
    expect(smsNumberMention("Simulate a tax reminder with 9171234567 as the reference")).toEqual({
      kind: "none",
    });
    expect(smsNumberMention('Send an SMS that says "Pay to 9171234567" to 0947 214 5415')).toEqual({
      kind: "valid",
      number: "+639472145415",
      value: "0947 214 5415",
    });
  });

  test("extracts only an explicitly quoted SMS body", () => {
    expect(extractExplicitSmsMessage('Send an SMS that says "Your filing is ready"')).toBe(
      "Your filing is ready",
    );
    expect(extractExplicitSmsMessage("Send an SMS that says 'Your filing is ready'")).toBe(
      "Your filing is ready",
    );
    expect(extractExplicitSmsMessage("Send an SMS saying hello")).toBeUndefined();
  });

  test("prefers a chat-supplied number and masks the tool output", async () => {
    const requests: EMessageSmsRequest[] = [];
    const output = await sendSmsMessage(
      { message: "Your application is ready.", number: "0917 111 2233" },
      "+639999999999",
      {
        client: recordingClient(requests),
        env: { ...process.env, EMESSAGE_ALLOWED_RECIPIENTS: "+639171112233" },
      },
    );

    expect(requests).toEqual([{ message: "Your application is ready.", number: "+639171112233" }]);
    expect(output).toMatchObject({
      deliveryConfirmed: false,
      message: "Your application is ready.",
      provider: "eMessage",
      recipient: "+63••••••2233",
      status: "accepted",
    });
  });

  test("falls back to the authenticated SSO mobile number", async () => {
    const requests: EMessageSmsRequest[] = [];
    await sendSmsMessage({ message: "Hello" }, "+63 917 000 0000", {
      client: recordingClient(requests),
    });
    expect(requests[0]?.number).toBe("+639170000000");
  });

  test("rejects chat recipients that are neither the SSO number nor allowlisted", async () => {
    const requests: EMessageSmsRequest[] = [];
    await expect(
      sendSmsMessage({ message: "Hello", number: "+639171112233" }, "+639170000000", {
        client: recordingClient(requests),
        env: { ...process.env, EMESSAGE_ALLOWED_RECIPIENTS: "" },
      }),
    ).rejects.toThrow("not a verified eMessage recipient");
    expect(requests).toHaveLength(0);
  });

  test("builds and sends a clearly labeled simulated tax reminder", async () => {
    const requests: EMessageSmsRequest[] = [];
    const output = await simulateTaxPaymentReminder(
      {
        businessName: "Juan Studio",
        taxTitle: "Quarterly income tax return",
        formCode: "1701Q",
        dueDate: "2026-08-25",
      },
      "+639170000000",
      { client: recordingClient(requests) },
    );

    expect(requests[0]?.message).toContain("SIMULATION");
    expect(requests[0]?.message).toContain("Juan Studio");
    expect(requests[0]?.message).toContain("1701Q");
    expect(requests[0]?.message).toContain("Aug 25, 2026");
    expect(output).toMatchObject({
      deliveryConfirmed: false,
      simulation: true,
      status: "accepted",
    });
  });

  test("rejects invalid reminder dates before sending", async () => {
    const requests: EMessageSmsRequest[] = [];
    await expect(
      simulateTaxPaymentReminder({ dueDate: "2026-02-31" }, "+639170000000", {
        client: recordingClient(requests),
      }),
    ).rejects.toThrow("valid calendar date");
    expect(requests).toHaveLength(0);
  });

  test("rejects an invalid chat-supplied number instead of falling back to SSO", async () => {
    const requests: EMessageSmsRequest[] = [];
    await expect(
      simulateTaxPaymentReminder({ number: "091712345678" }, "+639170000000", {
        client: recordingClient(requests),
      }),
    ).rejects.toThrow("valid E.164");
    expect(requests).toHaveLength(0);
  });

  test("bounds provider calls with an abort signal", async () => {
    let signal: AbortSignal | undefined;
    const client: EMessageClient = {
      async sendSms(_request, options) {
        signal = options?.signal;
        return { data: { message: "Accepted" } };
      },
    };

    await sendSmsMessage({ message: "Hello" }, "+639170000000", { client });
    expect(signal).toBeDefined();
  });

  test("aborts a stalled provider request at the configured timeout", async () => {
    const client: EMessageClient = {
      sendSms(_request, options) {
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          });
        });
      },
    };

    await expect(
      sendSmsMessage({ message: "Hello" }, "+639170000000", {
        client,
        timeoutMs: 5,
      }),
    ).rejects.toBeDefined();
  });

  test("only treats affirmative simulation requests as the reminder trigger", () => {
    expect(isTaxPaymentReminderSimulationRequest("Simulate the tax payment reminder")).toBe(true);
    expect(isTaxPaymentReminderSimulationRequest("Send a simulated tax reminder SMS")).toBe(true);
    expect(isTaxPaymentReminderSimulationRequest("Simulate my BIR Form 1701Q reminder")).toBe(true);
    expect(isTaxPaymentReminderSimulationRequest("Can you simulate my tax payment reminder?")).toBe(
      true,
    );
    expect(isTaxPaymentReminderSimulationRequest("When is my next tax payment?")).toBe(false);
    expect(isTaxPaymentReminderSimulationRequest("Remind me about tax")).toBe(false);
    expect(isTaxPaymentReminderSimulationRequest("Do not simulate the tax payment reminder")).toBe(
      false,
    );
    expect(
      isTaxPaymentReminderSimulationRequest(
        "What does “simulate the tax payment reminder” actually do?",
      ),
    ).toBe(false);
    expect(
      isTaxPaymentReminderSimulationRequest(
        "Can you simulate my tax payment reminder without actually sending anything?",
      ),
    ).toBe(false);
    expect(
      isTaxPaymentReminderSimulationRequest(
        "Send no simulated tax payment reminder; only preview it",
      ),
    ).toBe(false);
    expect(
      isTaxPaymentReminderSimulationRequest(
        'Send an SMS that says "Your simulated tax payment reminder is ready"',
      ),
    ).toBe(false);
    expect(
      isTaxPaymentReminderSimulationRequest(
        "Send an SMS that says 'Your simulated tax payment reminder is ready'",
      ),
    ).toBe(false);
  });

  test("recognizes explicit SMS sends and contextual reminder retries", () => {
    expect(isExplicitSmsSendRequest('Send an SMS that says "Your filing is ready"')).toBe(true);
    expect(isExplicitSmsSendRequest("Text 0917 123 4567 with the update")).toBe(true);
    expect(isExplicitSmsSendRequest("What happens when an SMS is sent?")).toBe(false);
    expect(isExplicitSmsSendRequest("Do not send an SMS")).toBe(false);
    expect(isExplicitSmsSendRequest("Send an SMS, but don't actually do it")).toBe(false);
    expect(isExplicitSmsSendRequest('Send an SMS that says "Hello"\nActually, not now.')).toBe(
      false,
    );
    expect(isExplicitSmsSendRequest(`Send an SMS that says "${"A".repeat(300)}" but not now`)).toBe(
      false,
    );
    expect(isExplicitSmsSendRequest('Send an SMS that says "Do not forget your filing"')).toBe(
      true,
    );
    expect(isTaxPaymentReminderRetryRequest("Try with 0947 214 5415")).toBe(true);
    expect(isTaxPaymentReminderRetryRequest("What about 0947 214 5415?")).toBe(false);
  });
});

test("tax reminder copy remains useful without a saved obligation", () => {
  expect(buildTaxPaymentReminderMessage({})).toContain("upcoming tax payment is approaching");
});

test("selects a named tax obligation and rejects unknown or ambiguous references", () => {
  const obligation = (title: string, formCode: string, dueDate: string): TaxObligation => ({
    dueDate,
    formCode,
    frequency: "Quarterly",
    id: formCode,
    note: "Mock schedule.",
    periodLabel: "Q2 2026",
    status: "Upcoming",
    title,
  });
  const obligations = [
    obligation("Monthly withholding tax return", "BIR Form 0619E", "2026-08-10"),
    obligation("Quarterly income tax return", "BIR Form 1701Q", "2026-08-25"),
  ];

  expect(selectTaxReminderObligation(obligations, "Simulate my BIR Form 1701Q reminder")).toEqual({
    kind: "selected",
    obligation: obligations[1],
  });
  expect(selectTaxReminderObligation(obligations, "Simulate my 0619E and 1701Q reminders")).toEqual(
    {
      kind: "ambiguous",
    },
  );
  expect(selectTaxReminderObligation(obligations, "Simulate my BIR Form 2550Q reminder")).toEqual({
    kind: "not-found",
    reference: "BIR Form 2550Q",
  });
  expect(
    selectTaxReminderObligation(obligations, "Simulate my quarterly income tax reminder"),
  ).toEqual({
    kind: "selected",
    obligation: obligations[1],
  });
  expect(selectTaxReminderObligation(obligations, "Simulate the tax payment reminder")).toEqual({
    kind: "selected",
    obligation: obligations[0],
  });
  expect(hasTaxObligationReference("Try with 0947 214 5415")).toBe(false);
  expect(hasTaxObligationReference("Try with 0947 214 5415 for BIR Form 1701Q")).toBe(true);
});
