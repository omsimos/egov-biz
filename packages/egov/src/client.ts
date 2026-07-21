import { EgovApiError } from "./errors.js";
import type {
  EgovFetch,
  EgovQueryValue,
  EgovRequest,
  EgovTransport,
  EgovTransportOptions,
} from "./types.js";

function addQueryValue(searchParams: URLSearchParams, key: string, value: EgovQueryValue): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      searchParams.append(key, String(item));
    }
    return;
  }

  searchParams.append(key, String(value));
}

function createUrl(baseUrl: string, path: string, query: EgovRequest["query"]): URL {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBaseUrl);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      addQueryValue(url.searchParams, key, value);
    }
  }

  return url;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

function getRequestBody<TBody>(
  request: EgovRequest<TBody>,
  headers: Headers,
): BodyInit | undefined {
  if (request.body === undefined) {
    return undefined;
  }

  if (request.bodyType === "raw") {
    return request.body as BodyInit;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return JSON.stringify(request.body);
}

export function createEgovTransport(options: EgovTransportOptions): EgovTransport {
  const baseUrl = options.baseUrl;
  const fetchImplementation: EgovFetch = options.fetch ?? globalThis.fetch;
  const defaultHeaders = new Headers(options.headers);

  return {
    baseUrl,
    async request<TResponse, TBody = unknown>(request: EgovRequest<TBody>): Promise<TResponse> {
      const url = createUrl(baseUrl, request.path, request.query);
      const headers = new Headers(defaultHeaders);

      for (const [key, value] of new Headers(request.headers)) {
        headers.set(key, value);
      }

      if (!headers.has("accept")) {
        headers.set("accept", "application/json");
      }

      const requestBody = getRequestBody(request, headers);
      const requestInit: RequestInit = {
        headers,
        method: request.method,
      };

      if (requestBody !== undefined) {
        requestInit.body = requestBody;
      }

      if (request.signal !== undefined) {
        requestInit.signal = request.signal;
      }

      const response = await fetchImplementation(url, requestInit);
      const body = await parseResponse(response);

      if (!response.ok) {
        throw new EgovApiError({
          body,
          headers: response.headers,
          method: request.method,
          status: response.status,
          statusText: response.statusText,
          url: url.toString(),
        });
      }

      return body as TResponse;
    },
  };
}
