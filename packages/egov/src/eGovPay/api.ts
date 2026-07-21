import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import { requireEgovEnvironment } from "../core/env.js";
import type { EgovCallOptions } from "../core/types.js";
import type {
  EgovPayClient,
  EgovPayClientOptions,
  EgovPayEnvironmentClientOptions,
  EgovPayGeneratePaymentResponse,
  EgovPayTransactionResponse,
  EgovPayVoidResponse,
} from "./types.js";

export const EGOV_PAY_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/egovpay" as const;

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

function apiHeaders(apiKey: string, options?: EgovCallOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set("x-egovpay-token", apiKey);
  return headers;
}

function encodeTransactionUuid(transactionUuid: string): string {
  return encodeURIComponent(transactionUuid);
}

function digestKey(apiKey: string): string {
  // Staging tokens use the prefix to route the request, but eGovPay signs the
  // transaction with the token value after that prefix. Production tokens are
  // used unchanged.
  return apiKey.startsWith("test_") ? apiKey.slice(5) : apiKey;
}

export async function createEgovPayDigest(
  amount: number,
  transactionId: string,
  apiKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiKey),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${amount}|${transactionId}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function createEgovPayClient(options: EgovPayClientOptions): EgovPayClient {
  const transport = createEgovTransport(options);

  return {
    async generatePayment(request, callOptions) {
      const digest = await createEgovPayDigest(
        request.amount,
        request.transactionId,
        digestKey(options.apiKey),
      );

      return transport.request<EgovPayGeneratePaymentResponse>({
        body: {
          amount: request.amount,
          callback_url: request.callbackUrl,
          currency: request.currency,
          description: request.description,
          digest,
          email: request.email,
          expires_at: request.expiresAt,
          items: request.items,
          link_expires_at: request.linkExpiresAt,
          mobile: request.mobile,
          name: request.name,
          redirect_url: request.redirectUrl,
          settlement_template_uuid: options.settlementTemplateUuid,
          txnid: request.transactionId,
        },
        headers: apiHeaders(options.apiKey, callOptions),
        method: "POST",
        path: "/api/v1/transaction",
        ...withSignal(callOptions),
      });
    },
    getTransaction(transactionUuid, callOptions) {
      return transport.request<EgovPayTransactionResponse>({
        headers: apiHeaders(options.apiKey, callOptions),
        method: "GET",
        path: `/api/v1/transaction/${encodeTransactionUuid(transactionUuid)}`,
        ...withSignal(callOptions),
      });
    },
    voidTransaction(transactionUuid, callOptions) {
      return transport.request<EgovPayVoidResponse>({
        headers: apiHeaders(options.apiKey, callOptions),
        method: "PUT",
        path: `/api/v1/transaction/${encodeTransactionUuid(transactionUuid)}/void`,
        ...withSignal(callOptions),
      });
    },
  };
}

export function createEgovPayClientFromEnv(
  options: EgovPayEnvironmentClientOptions,
): EgovPayClient {
  return createEgovPayClient({
    apiKey: requireEgovEnvironment("EGOVPAY_API_KEY", options.env),
    baseUrl: options.baseUrl,
    settlementTemplateUuid: requireEgovEnvironment("EGOVPAY_SETTLEMENT_TEMPLATE_UUID", options.env),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });
}

const tokenParameter = {
  location: "header",
  name: "X-eGovPay-Token",
  required: true,
  type: "string",
} as const;

export const egovPayCatalog = defineEgovCatalog({
  endpoints: [
    {
      body: {
        fields: [
          { name: "items", required: true, type: "array" },
          { name: "amount", required: true, type: "double" },
          { name: "settlement_template_uuid", required: true, type: "UUID" },
          { name: "redirect_url", required: true, type: "URL" },
          { name: "txnid", required: true, type: "string" },
          { name: "callback_url", required: true, type: "URL" },
          { name: "digest", required: true, type: "HMAC-SHA256" },
          { name: "currency", required: false, type: "string" },
          { name: "expires_at", required: false, type: "datetime" },
          { name: "link_expires_at", required: false, type: "datetime" },
        ],
      },
      description: "Create a transaction and hosted payment link.",
      id: "generate-payment",
      method: "POST",
      name: "Generate Payment",
      parameters: [tokenParameter],
      path: "/api/v1/transaction",
      responses: [
        { description: "Transaction and payment URL created.", status: 201 },
        { description: "Unauthorized merchant token.", status: 401 },
        { description: "Invalid payment request.", status: 422 },
      ],
    },
    {
      description: "Return transaction details by UUID.",
      id: "check-transaction-details",
      method: "GET",
      name: "Check Transaction Details",
      parameters: [
        tokenParameter,
        { location: "path", name: "uuid", required: true, type: "UUID" },
      ],
      path: "/api/v1/transaction/{uuid}",
      responses: [
        { description: "Transaction details.", status: 200 },
        { description: "Unauthorized merchant token.", status: 401 },
        { description: "Transaction not found.", status: 404 },
      ],
    },
    {
      description: "Void a transaction by UUID.",
      id: "void-transaction",
      method: "PUT",
      name: "Void Transaction",
      parameters: [
        tokenParameter,
        { location: "path", name: "uuid", required: true, type: "UUID" },
      ],
      path: "/api/v1/transaction/{uuid}/void",
      responses: [
        { description: "Transaction voided.", status: 200 },
        { description: "Transaction cannot be voided.", status: 400 },
        { description: "Unauthorized merchant token.", status: 401 },
        { description: "Transaction not found.", status: 404 },
      ],
    },
  ],
  id: "egovpay",
  name: "eGovPay",
  slug: "egovpay",
  sourceUrl: EGOV_PAY_SOURCE_URL,
  summary: "Create, inspect, and void government payment transactions.",
});
