import {
  createClient as createEgovClient,
  eMessage,
  type EMessageSmsRequest,
  type EMessageSmsResponse,
} from "egov.js";
import { z } from "zod";
import type { TaxObligation } from "@/lib/registered-business";

export type { EMessageSmsRequest, EMessageSmsResponse };

type EMessageCallOptions = {
  signal?: AbortSignal;
};

export type EMessageClient = {
  sendSms(request: EMessageSmsRequest, options?: EMessageCallOptions): Promise<EMessageSmsResponse>;
};

export class EMessageApiError extends Error {
  readonly body: unknown;
  readonly status: number;

  constructor(options: {
    body: unknown;
    method: string;
    status: number;
    statusText: string;
    url: string;
  }) {
    super(
      `${options.method} ${options.url} failed with ${options.status} ${options.statusText}`.trim(),
    );
    this.name = "EMessageApiError";
    this.body = options.body;
    this.status = options.status;
  }
}

const smsNumberSchema = z
  .string()
  .trim()
  .min(8)
  .max(32)
  .describe(
    "Recipient mobile number. Omit it to use the mobile number from the authenticated eGov SSO profile.",
  );

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Due date must be a valid calendar date");

export const sendSmsMessageInputSchema = z.object({
  message: z.string().trim().min(1).max(480).describe("SMS message body to send."),
  number: smsNumberSchema.optional(),
});

export const simulateTaxPaymentReminderInputSchema = z.object({
  number: smsNumberSchema.optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
  taxTitle: z.string().trim().min(1).max(120).optional(),
  formCode: z.string().trim().min(1).max(40).optional(),
  dueDate: isoDateSchema.describe("Upcoming tax due date in YYYY-MM-DD format.").optional(),
});

export type SendSmsMessageInput = z.infer<typeof sendSmsMessageInputSchema>;
export type SimulateTaxPaymentReminderInput = z.infer<typeof simulateTaxPaymentReminderInputSchema>;

export type SendSmsMessageOutput = {
  channel: "SMS";
  deliveryConfirmed: false;
  message: string;
  provider: "eMessage";
  providerMessage: string;
  recipient: string;
  status: "accepted";
};

export type SimulateTaxPaymentReminderOutput = SendSmsMessageOutput & {
  reminder: {
    businessName?: string;
    dueDate?: string;
    formCode?: string;
    taxTitle?: string;
  };
  simulation: true;
};

type SmsSender = Pick<EMessageClient, "sendSms">;

type SmsDependencies = {
  client?: SmsSender;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function createClient(env: NodeJS.ProcessEnv): SmsSender {
  const baseUrl = env.EMESSAGE_BASE_URL?.trim();
  if (!baseUrl) throw new Error("Missing required eGov environment variable: EMESSAGE_BASE_URL");
  const accessToken = env.EMESSAGE_ACCESS_TOKEN?.trim();
  if (!accessToken)
    throw new Error("Missing required eGov environment variable: EMESSAGE_ACCESS_TOKEN");

  const client = createEgovClient({ baseUrl });
  client.interceptors.error.use((body, response, request) => {
    if (!response || !request) return body;
    return new EMessageApiError({
      body,
      method: request.method,
      status: response.status,
      statusText: response.statusText,
      url: request.url,
    });
  });

  return {
    sendSms(request, options) {
      // The SDK distinguishes "no signal" from "a signal", so an aborted-less
      // call passes no `signal` key at all rather than an undefined one.
      const signal = options?.signal;
      if (!signal)
        return eMessage.sendSms({ auth: accessToken, body: request, client, throwOnError: true });
      return eMessage.sendSms({
        auth: accessToken,
        body: request,
        client,
        signal,
        throwOnError: true,
      });
    },
  };
}

export function normalizeSmsNumber(value: string): string {
  let compact = value.trim().replace(/[().\s-]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  else if (/^09\d{9}$/.test(compact)) compact = `+63${compact.slice(1)}`;
  else if (/^9\d{9}$/.test(compact)) compact = `+63${compact}`;
  else if (/^63\d{10}$/.test(compact)) compact = `+${compact}`;

  if (!/^\+[1-9]\d{7,14}$/.test(compact))
    throw new Error("Recipient mobile number must be a valid E.164 number");
  return compact;
}

export type SmsNumberMention =
  | { kind: "none" }
  | { kind: "valid"; number: string; value: string }
  | { kind: "invalid"; value: string }
  | { kind: "ambiguous"; values: string[] };

function withoutQuotedSegments(text: string): string {
  const doubleQuoted = text.replace(/"[^"]*"|“[^”]*”/g, (quoted) => " ".repeat(quoted.length));
  return doubleQuoted.replace(
    /(\b(?:says?|saying|(?:with\s+the\s+)?message(?:\s+(?:is|body))?)\s*)'[^']*'/gi,
    (quoted, prefix: string) => `${prefix}${" ".repeat(quoted.length - prefix.length)}`,
  );
}

export function smsNumberMention(text: string): SmsNumberMention {
  const searchableText = withoutQuotedSegments(text);
  const reminderSimulationRequest = isTaxPaymentReminderSimulationRequest(text);
  const recipientMatches: RegExpMatchArray[] = [];
  for (const match of searchableText.matchAll(
    /(?<!\d)(?:\+?63|0063|0)?[\s().-]*9(?:[\s().-]*\d){6,14}(?!\d)/g,
  )) {
    const index = match.index ?? 0;
    const prefix = searchableText.slice(Math.max(0, index - 48), index);
    const suffix = searchableText.slice(index + match[0].length, index + match[0].length + 48);
    const previous = recipientMatches.at(-1);
    const hasRecipientContext =
      /\b(?:(?:send|text|to|at|use|using)\s*(?:the\s+)?(?:(?:recipient|mobile|phone)\s+)?(?:number\s*)?|(?:recipient|mobile|phone)\s*(?:number\s*)?|(?:try|retry)\s+with\s*)(?:is\s*)?[:=-]?\s*$/i.test(
        prefix,
      );
    const hasReminderContext =
      reminderSimulationRequest &&
      !/\b(?:reference|confirmation|transaction|form)\s+(?:number|code)\s*[:=#-]?\s*$/i.test(
        prefix,
      ) &&
      !/^\s*(?:as\s+)?(?:the\s+)?(?:reference|confirmation|transaction|form)(?:\s+(?:number|code))?\b/i.test(
        suffix,
      );
    const continuesRecipientList =
      previous &&
      /^\s*(?:,|\/|or|and)\s*$/i.test(
        searchableText.slice((previous.index ?? 0) + previous[0].length, index),
      );
    if (hasRecipientContext || hasReminderContext || continuesRecipientList)
      recipientMatches.push(match);
  }
  const values = recipientMatches.map((match) =>
    text.slice(match.index, (match.index ?? 0) + match[0].length).trim(),
  );
  if (!values.length) return { kind: "none" };

  const normalized = new Map<string, string>();
  const invalid: string[] = [];
  for (const value of values) {
    try {
      normalized.set(normalizeSmsNumber(value), value);
    } catch {
      invalid.push(value);
    }
  }

  if (values.length === 1 && invalid.length === 1) return { kind: "invalid", value: values[0]! };
  if (invalid.length || normalized.size > 1)
    return { kind: "ambiguous", values: [...new Set(values)] };
  const [number, value] = normalized.entries().next().value ?? [];
  return number && value
    ? { kind: "valid", number, value }
    : { kind: "invalid", value: values[0]! };
}

export function extractSmsNumber(text: string): string | undefined {
  const mention = smsNumberMention(text);
  return mention.kind === "valid" ? mention.number : undefined;
}

export function extractExplicitSmsMessage(text: string): string | undefined {
  const match = text.match(
    /\b(?:says?|saying|(?:with\s+the\s+)?message(?:\s+(?:is|body))?)\s*(?:"([^"]+)"|“([^”]+)”|'([^']+)')/i,
  );
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}

export function maskSmsNumber(number: string): string {
  const visiblePrefix = number.slice(0, Math.min(3, number.length - 4));
  return `${visiblePrefix}${"•".repeat(Math.max(4, number.length - visiblePrefix.length - 4))}${number.slice(-4)}`;
}

export type TaxObligationSelection =
  | { kind: "selected"; obligation: TaxObligation }
  | { kind: "ambiguous" }
  | { kind: "not-found"; reference: string }
  | { kind: "none" };

export function selectTaxReminderObligation(
  obligations: TaxObligation[],
  prompt: string,
): TaxObligationSelection {
  const normalizedPrompt = prompt.toLowerCase().replace(/\s+/g, " ");
  const formReferences = [
    ...new Set(
      [...prompt.matchAll(/\b(?:BIR\s+Form\s+)?\d{4}[A-Z]\b/gi)].map((match) =>
        match[0].replace(/^BIR\s+Form\s+/i, "").toUpperCase(),
      ),
    ),
  ];
  if (formReferences.length > 1) return { kind: "ambiguous" };
  if (formReferences.length === 1) {
    const reference = formReferences[0]!;
    const match = obligations.find(
      (obligation) =>
        obligation.formCode.replace(/^BIR\s+Form\s+/i, "").toUpperCase() === reference,
    );
    return match
      ? { kind: "selected", obligation: match }
      : { kind: "not-found", reference: `BIR Form ${reference}` };
  }

  const titleMatches = obligations.filter((obligation) => {
    const title = obligation.title.toLowerCase().replace(/\s+/g, " ");
    return normalizedPrompt.includes(title);
  });
  if (titleMatches.length === 1) return { kind: "selected", obligation: titleMatches[0]! };
  if (titleMatches.length > 1) return { kind: "ambiguous" };

  const promptWords = new Set(normalizedPrompt.match(/[a-z0-9]+/g) ?? []);
  const ignoredWords = new Set(["tax", "return", "payment", "reminder", "review"]);
  const scored = obligations
    .map((obligation) => {
      const words = new Set(
        `${obligation.frequency} ${obligation.title}`.toLowerCase().match(/[a-z0-9]+/g) ?? [],
      );
      const score = [...words].filter(
        (word) => word.length > 3 && !ignoredWords.has(word) && promptWords.has(word),
      ).length;
      return { obligation, score };
    })
    .filter(({ score }) => score > 0);
  const highestScore = Math.max(0, ...scored.map(({ score }) => score));
  const descriptiveMatches = scored.filter(({ score }) => score === highestScore);
  if (descriptiveMatches.length === 1)
    return { kind: "selected", obligation: descriptiveMatches[0]!.obligation };
  if (descriptiveMatches.length > 1) return { kind: "ambiguous" };

  const explicitReference = prompt.match(/\bBIR\s+Form\s+[0-9A-Z-]+\b/i)?.[0];
  if (explicitReference) return { kind: "not-found", reference: explicitReference };
  if (
    /\b(?:annual|quarterly|monthly|withholding|income|registration|vat|percentage|corporate|excise)\b/i.test(
      prompt,
    )
  )
    return { kind: "not-found", reference: "that tax obligation" };
  return obligations[0] ? { kind: "selected", obligation: obligations[0] } : { kind: "none" };
}

export function hasTaxObligationReference(text: string): boolean {
  return (
    /\b(?:BIR\s+Form\s+)?\d{4}[A-Z]\b/i.test(text) ||
    /\b(?:annual|quarterly|monthly|withholding|income|registration|vat|percentage|corporate|excise)\b/i.test(
      text,
    )
  );
}

export function resolveSmsRecipient(
  inputNumber: string | undefined,
  profileMobile: string,
): string {
  const value = inputNumber?.trim() || profileMobile.trim();
  if (!value)
    throw new Error(
      "A recipient mobile number is required in the chat or authenticated eGov SSO profile",
    );
  return normalizeSmsNumber(value);
}

export async function sendSmsMessage(
  input: SendSmsMessageInput,
  profileMobile: string,
  dependencies: SmsDependencies = {},
): Promise<SendSmsMessageOutput> {
  const parsed = sendSmsMessageInputSchema.parse(input);
  const env = dependencies.env ?? process.env;
  const number = resolveSmsRecipient(parsed.number, profileMobile);
  const client = dependencies.client ?? createClient(env);
  const timeoutSignal = AbortSignal.timeout(dependencies.timeoutMs ?? 15_000);
  const signal = dependencies.signal
    ? AbortSignal.any([dependencies.signal, timeoutSignal])
    : timeoutSignal;
  const response = await client.sendSms({ message: parsed.message, number }, { signal });

  return {
    channel: "SMS",
    deliveryConfirmed: false,
    message: parsed.message,
    provider: "eMessage",
    providerMessage: response.data?.message || "SMS accepted by eMessage",
    recipient: maskSmsNumber(number),
    status: "accepted",
  };
}

function formatDueDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function buildTaxPaymentReminderMessage(input: SimulateTaxPaymentReminderInput): string {
  const business = input.businessName ? ` for ${input.businessName}` : "";
  const tax = input.taxTitle || input.formCode || "tax payment";
  const form = input.taxTitle && input.formCode ? ` (${input.formCode})` : "";
  const due = input.dueDate ? ` due on ${formatDueDate(input.dueDate)}` : "";
  return `SIMULATION — eGov tax reminder${business}: Your upcoming ${tax}${form} is${due || " approaching"}. Please review your BIR tax calendar and pay on or before the deadline. Confirm the filing and deadline with BIR.`;
}

export async function simulateTaxPaymentReminder(
  input: SimulateTaxPaymentReminderInput,
  profileMobile: string,
  dependencies: SmsDependencies = {},
): Promise<SimulateTaxPaymentReminderOutput> {
  const parsed = simulateTaxPaymentReminderInputSchema.parse(input);
  const reminderSms: SendSmsMessageInput = { message: buildTaxPaymentReminderMessage(parsed) };
  // An omitted number means "send to the number on the SSO profile", so the key
  // is only added when the caller actually supplied one.
  if (parsed.number) reminderSms.number = parsed.number;
  const output = await sendSmsMessage(reminderSms, profileMobile, dependencies);
  const { number: _number, ...reminder } = parsed;
  return { ...output, reminder, simulation: true };
}

export function isTaxPaymentReminderSimulationRequest(text: string): boolean {
  const commandText = withoutQuotedSegments(text);
  if (hasNegatedSendIntent(commandText)) return false;
  const simulation = /\b(?:simulat(?:e|ed|es|ing|ion)|mock(?:ed|ing)?|demo|test(?:ed|ing)?)\b/i;
  const reminder = /\b(?:remind(?:er|ing)?|notification|notice)\b/i;
  const taxMessage =
    (/\btax(?:es)?\b/i.test(commandText) || /\bBIR\s+Form\s+[0-9A-Z-]+\b/i.test(commandText)) &&
    /\b(?:payment|sms|message)\b/i.test(commandText);
  if (!simulation.test(commandText) || (!reminder.test(commandText) && !taxMessage)) return false;

  return !(
    /^\s*(?:what|why|how|when|where|who)\b/i.test(commandText) ||
    /^\s*(?:explain|describe|tell\s+me\s+about)\b/i.test(commandText) ||
    /^\s*(?:is|are)\b.*\b(?:available|possible|supported)\b/i.test(commandText)
  );
}

function hasNegatedSendIntent(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  const action = String.raw`\b(?:send(?:ing|s|ed)?|text(?:ing|s|ed)?|simulat(?:e|es|ed|ing|ion)|mock(?:ed|ing)?|demo|test(?:ed|ing)?|try|retry|use)\b`;
  const negationBeforeAction = new RegExp(
    String.raw`\b(?:do\s+not|don't|dont|never|stop|avoid)\b.{0,120}${action}`,
    "i",
  );
  const withoutAction = new RegExp(String.raw`\bwithout\b.{0,40}\b(?:actually\s+)?${action}`, "i");
  const trailingNegation = new RegExp(
    String.raw`${action}.*\b(?:(?:but|actually)[,\s]+)*(?:do\s+not|don't|dont|never|stop|not\s+now|cancel(?:\s+(?:that|it))?)\b`,
    "i",
  );
  const negativeObject = new RegExp(String.raw`${action}\s+(?:absolutely\s+)?no\b`, "i");
  const previewOnly =
    /\b(?:(?:only|just)\s+(?:preview|draft)|(?:preview|draft)(?:\s+it)?\s+only)\b/i;
  return (
    negationBeforeAction.test(normalized) ||
    withoutAction.test(normalized) ||
    trailingNegation.test(normalized) ||
    negativeObject.test(normalized) ||
    previewOnly.test(normalized)
  );
}

export function isExplicitSmsSendRequest(text: string): boolean {
  const commandText = withoutQuotedSegments(text);
  if (hasNegatedSendIntent(commandText)) return false;
  const command =
    /^\s*(?:please\s+)?(?:send|text)\b/i.test(commandText) ||
    /^\s*(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:send|text)\b/i.test(commandText) ||
    /^\s*i(?:'d| would)?\s+like\s+(?:you\s+)?to\s+(?:send|text)\b/i.test(commandText) ||
    /^\s*i\s+(?:want|need)\s+(?:you\s+)?to\s+(?:send|text)\b/i.test(commandText);
  const hasSmsChannel = /\b(?:sms|text(?:\s+message)?)\b/i.test(commandText);
  return command && (hasSmsChannel || smsNumberMention(text).kind !== "none");
}

export function isTaxPaymentReminderRetryRequest(text: string): boolean {
  const commandText = withoutQuotedSegments(text);
  if (hasNegatedSendIntent(commandText)) return false;
  const command =
    /^\s*(?:please\s+)?(?:try|retry|send|use)\b/i.test(commandText) ||
    /^\s*(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:try|retry|send|use)\b/i.test(
      commandText,
    );
  return command && smsNumberMention(text).kind !== "none";
}
