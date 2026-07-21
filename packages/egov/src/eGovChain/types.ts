import type { EgovCallOptions, EgovTransportOptions } from "../core/types.js";

export type EgovChainRpcId = number | string;

export interface EgovChainRpcErrorData {
  code: number;
  data?: unknown;
  message: string;
}

export interface EgovChainRpcSuccess<TResult> {
  id: EgovChainRpcId;
  jsonrpc: "2.0";
  result: TResult;
}

export interface EgovChainRpcFailure {
  error: EgovChainRpcErrorData;
  id: EgovChainRpcId | null;
  jsonrpc: "2.0";
}

export interface EgovChainClientOptions extends Omit<EgovTransportOptions, "baseUrl"> {
  baseUrl?: string;
}

export interface EgovChainClient {
  blockNumber(options?: EgovCallOptions): Promise<string>;
  call<TResult = string>(
    transaction: Record<string, unknown>,
    block?: string,
    options?: EgovCallOptions,
  ): Promise<TResult>;
  chainId(options?: EgovCallOptions): Promise<string>;
  clientVersion(options?: EgovCallOptions): Promise<string>;
  getBalance(address: string, block?: string, options?: EgovCallOptions): Promise<string>;
  getLogs<TResult = Array<Record<string, unknown>>>(
    filter: Record<string, unknown>,
    options?: EgovCallOptions,
  ): Promise<TResult>;
  modules(options?: EgovCallOptions): Promise<Record<string, string>>;
  request<TResult, TParams extends readonly unknown[] = readonly unknown[]>(
    method: string,
    params?: TParams,
    options?: EgovCallOptions & { id?: EgovChainRpcId },
  ): Promise<TResult>;
  sendRawTransaction(signedTransaction: string, options?: EgovCallOptions): Promise<string>;
}
