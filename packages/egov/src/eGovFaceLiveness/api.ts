import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import { requireEgovEnvironment } from "../core/env.js";
import type { EgovCallOptions } from "../core/types.js";
import type {
  FaceLivenessClient,
  FaceLivenessClientOptions,
  FaceLivenessCreateSessionResponse,
  FaceLivenessEnvironmentClientOptions,
  FaceLivenessVerificationResult,
} from "./types.js";

export const FACE_LIVENESS_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/face-liveness" as const;

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

function apiHeaders(apiKey: string, options?: EgovCallOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set("x-api-key", apiKey);
  return headers;
}

export function createFaceLivenessClient(options: FaceLivenessClientOptions): FaceLivenessClient {
  const transport = createEgovTransport(options);

  return {
    createSession(request, callOptions) {
      return transport.request<FaceLivenessCreateSessionResponse>({
        body: {
          action: request.action,
          callback_url: request.callbackUrl,
          delay: request.delay,
        },
        headers: apiHeaders(options.apiKey, callOptions),
        method: "POST",
        path: "/v1/liveness/session",
        ...withSignal(callOptions),
      });
    },
    getVerificationResult(sessionToken, callOptions) {
      return transport.request<FaceLivenessVerificationResult>({
        headers: apiHeaders(options.apiKey, callOptions),
        method: "GET",
        path: `/v1/liveness/result/${encodeURIComponent(sessionToken)}`,
        ...withSignal(callOptions),
      });
    },
  };
}

export function createFaceLivenessClientFromEnv(
  options: FaceLivenessEnvironmentClientOptions,
): FaceLivenessClient {
  return createFaceLivenessClient({
    apiKey: requireEgovEnvironment("EGOVLIVENESS_API_KEY", options.env),
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });
}

const apiKeyParameter = {
  location: "header",
  name: "x-api-key",
  required: true,
  type: "string",
} as const;

export const faceLivenessCatalog = defineEgovCatalog({
  endpoints: [
    {
      body: {
        fields: [
          { name: "action", required: true, type: "redirect | post | close" },
          {
            description: "Required when action is redirect.",
            name: "callback_url",
            required: false,
            type: "URL",
          },
          { name: "delay", required: false, type: "integer" },
        ],
      },
      description: "Create a liveness session and dynamic verification URL.",
      id: "create-session",
      method: "POST",
      name: "Create Session",
      parameters: [apiKeyParameter],
      path: "/v1/liveness/session",
      responses: [{ description: "Session and verification URL created.", status: 201 }],
    },
    {
      description: "Retrieve status, confidence score, and the pre-signed reference image URL.",
      id: "get-verification-result",
      method: "GET",
      name: "Get Verification Result",
      parameters: [
        apiKeyParameter,
        { location: "path", name: "sessionToken", required: true, type: "string" },
      ],
      path: "/v1/liveness/result/{sessionToken}",
      responses: [{ description: "Verification result returned.", status: 200 }],
    },
  ],
  id: "face-liveness",
  name: "Face Liveness",
  slug: "face-liveness",
  sourceUrl: FACE_LIVENESS_SOURCE_URL,
  summary: "Create liveness checks and retrieve their verification results.",
});

export const eGovFaceLivenessApi = Object.freeze({
  catalog: faceLivenessCatalog,
  create: createFaceLivenessClient,
  fromEnv: createFaceLivenessClientFromEnv,
});
