import { createHmac } from "node:crypto";
import {
  egovPay,
  type Client,
  type EgovPayGeneratePaymentResponse,
  type EgovPayTransactionResponse,
  type EgovPayVoidResponse,
} from "egov.js";

export interface EgovPayCallOptions {
  signal?: AbortSignal;
}

export interface EgovPayGeneratePaymentRequest {
  amount: number;
  callbackUrl: string;
  currency?: string;
  description?: Record<string, unknown>;
  email?: string;
  expiresAt?: string;
  items: Array<{ amount: number; name: string }>;
  linkExpiresAt?: string;
  mobile?: string;
  name?: string;
  redirectUrl: string;
  transactionId: string;
}

export interface EgovPayClient {
  generatePayment(
    request: EgovPayGeneratePaymentRequest,
    options?: EgovPayCallOptions,
  ): Promise<EgovPayGeneratePaymentResponse>;
  getTransaction(
    transactionUuid: string,
    options?: EgovPayCallOptions,
  ): Promise<EgovPayTransactionResponse>;
  voidTransaction(
    transactionUuid: string,
    options?: EgovPayCallOptions,
  ): Promise<EgovPayVoidResponse>;
}

export interface EgovPayClientOptions {
  apiKey: string;
  client: Client;
  settlementTemplateUuid: string;
}

function paymentDigest(amount: number, transactionId: string, apiKey: string) {
  const signingKey = apiKey.startsWith("test_") ? apiKey.slice(5) : apiKey;
  return createHmac("sha256", signingKey).update(`${amount}|${transactionId}`).digest("hex");
}

function signalOption(options: EgovPayCallOptions | undefined) {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

export function createEgovPayClient(options: EgovPayClientOptions): EgovPayClient {
  return {
    generatePayment(request, callOptions) {
      return egovPay.generatePayment({
        auth: options.apiKey,
        body: {
          amount: request.amount,
          callback_url: request.callbackUrl,
          digest: paymentDigest(request.amount, request.transactionId, options.apiKey),
          items: request.items,
          redirect_url: request.redirectUrl,
          settlement_template_uuid: options.settlementTemplateUuid,
          txnid: request.transactionId,
          ...(request.currency === undefined ? {} : { currency: request.currency }),
          ...(request.description === undefined ? {} : { description: request.description }),
          ...(request.email === undefined ? {} : { email: request.email }),
          ...(request.expiresAt === undefined ? {} : { expires_at: request.expiresAt }),
          ...(request.linkExpiresAt === undefined
            ? {}
            : { link_expires_at: request.linkExpiresAt }),
          ...(request.mobile === undefined ? {} : { mobile: request.mobile }),
          ...(request.name === undefined ? {} : { name: request.name }),
        },
        client: options.client,
        ...signalOption(callOptions),
        throwOnError: true,
      });
    },
    getTransaction(transactionUuid, callOptions) {
      return egovPay.getTransaction({
        auth: options.apiKey,
        client: options.client,
        path: { uuid: transactionUuid },
        ...signalOption(callOptions),
        throwOnError: true,
      });
    },
    voidTransaction(transactionUuid, callOptions) {
      return egovPay.voidTransaction({
        auth: options.apiKey,
        client: options.client,
        path: { uuid: transactionUuid },
        ...signalOption(callOptions),
        throwOnError: true,
      });
    },
  };
}
