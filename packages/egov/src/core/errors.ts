export interface EgovApiErrorOptions {
  body: unknown;
  headers: Headers;
  method: string;
  status: number;
  statusText: string;
  url: string;
}

export class EgovApiError extends Error {
  readonly body: unknown;
  readonly headers: Headers;
  readonly method: string;
  readonly status: number;
  readonly statusText: string;
  readonly url: string;

  constructor(options: EgovApiErrorOptions) {
    super(
      `${options.method} ${options.url} failed with ${options.status} ${options.statusText}`.trim(),
    );
    this.name = "EgovApiError";
    this.body = options.body;
    this.headers = options.headers;
    this.method = options.method;
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
  }
}
