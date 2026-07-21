export type EgovHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export type EgovQueryPrimitive = boolean | number | string;

export type EgovQueryValue = EgovQueryPrimitive | readonly EgovQueryPrimitive[] | null | undefined;

export type EgovFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface EgovTransportOptions {
  baseUrl: string;
  fetch?: EgovFetch;
  headers?: HeadersInit;
}

export interface EgovCallOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export interface EgovRequest<TBody = unknown> {
  body?: TBody;
  bodyType?: "json" | "raw";
  headers?: HeadersInit;
  method: EgovHttpMethod;
  path: string;
  query?: Readonly<Record<string, EgovQueryValue>>;
  signal?: AbortSignal;
}

export interface EgovTransport {
  readonly baseUrl: string;
  request<TResponse, TBody = unknown>(request: EgovRequest<TBody>): Promise<TResponse>;
}
