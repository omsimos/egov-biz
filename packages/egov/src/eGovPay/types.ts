import type { EgovCallOptions, EgovTransportOptions } from "../core/types.js";

export interface EgovPayItem {
  amount: number;
  name: string;
}

export interface EgovPayGeneratePaymentRequest {
  amount: number;
  callbackUrl: string;
  currency?: string;
  description?: Record<string, unknown>;
  email?: string;
  expiresAt?: string;
  items: EgovPayItem[];
  linkExpiresAt?: string;
  mobile?: string;
  name?: string;
  redirectUrl: string;
  transactionId: string;
}

export interface EgovPayGeneratePaymentResponse {
  data: {
    channel: { refno: string };
    url: string;
    uuid: string;
  };
}

export interface EgovPayTransaction {
  amount: string;
  callback_url: string;
  channel_fee: string;
  created_at: string;
  currency: string;
  environment_type: string;
  expires_at: string;
  items: Array<{ amount: string; name: string }>;
  link_expires_at: string;
  paid_at: string | null;
  partner_fee: string;
  payment_channel: string | null;
  payment_channel_branch: string | null;
  payment_channel_uuid: string | null;
  payment_status: string;
  redirect_url: string;
  refno: string;
  system_fee: string;
  txnid: string;
  uuid: string;
}

export interface EgovPayTransactionResponse {
  data: EgovPayTransaction;
}

export interface EgovPayVoidResponse {
  data: { message: string };
}

export interface EgovPayClient {
  generatePayment(
    request: EgovPayGeneratePaymentRequest,
    options?: EgovCallOptions,
  ): Promise<EgovPayGeneratePaymentResponse>;
  getTransaction(
    transactionUuid: string,
    options?: EgovCallOptions,
  ): Promise<EgovPayTransactionResponse>;
  voidTransaction(transactionUuid: string, options?: EgovCallOptions): Promise<EgovPayVoidResponse>;
}

export interface EgovPayClientOptions extends EgovTransportOptions {
  apiKey: string;
  settlementTemplateUuid: string;
}

export interface EgovPayEnvironmentClientOptions extends EgovTransportOptions {
  env?: import("../core/env.js").EgovEnvironment;
}
