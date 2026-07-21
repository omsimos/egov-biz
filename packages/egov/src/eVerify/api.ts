import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import { requireEgovEnvironment, type EgovEnvironment } from "../core/env.js";
import type { EgovCallOptions, EgovTransport, EgovTransportOptions } from "../core/types.js";

export const EVERIFY_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/everify" as const;

export interface EverifyCredentials {
  clientId: string;
  clientSecret: string;
}

export interface EverifyAuthenticationResponse {
  data: {
    access_token: string;
    expires_at: string;
    token_type: string;
  };
}

export interface EverifyPersonalInformationRequest {
  birthDate: string;
  faceLivenessSessionId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
}

export interface EverifyIdentityProfile {
  address_line_1: string;
  address_line_2: string | null;
  barangay: string;
  birth_date: string;
  blood_type: string;
  code: string;
  country: string;
  email: string;
  face_url: string;
  first_name: string;
  full_address: string;
  full_name: string;
  gender: string;
  last_name: string;
  marital_status: string;
  middle_name: string;
  mobile_number: string;
  municipality: string;
  place_of_birth: string;
  pob_country: string;
  pob_municipality: string;
  pob_province: string;
  postal_code: string;
  present_address_line_1: string;
  present_address_line_2: string | null;
  present_barangay: string;
  present_country: string;
  present_full_address: string;
  present_municipality: string;
  present_postal_code: string;
  present_province: string;
  province: string;
  reference: string;
  residency_status: string;
  suffix: string | null;
  token: string;
}

export interface EverifyVerificationMeta {
  result_grade: number;
  tier_level: string;
}

export interface EverifyVerificationResponse {
  data: EverifyIdentityProfile;
  meta: EverifyVerificationMeta;
}

export interface EverifyQrCheckResponse<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  data: TData;
  meta: { qr_type: string };
}

export interface EverifyQrVerifyRequest {
  faceLivenessSessionId: string;
  value: string;
}

export interface EverifyClient {
  authenticate(
    credentials: EverifyCredentials,
    options?: EgovCallOptions,
  ): Promise<EverifyAuthenticationResponse>;
  checkQr<TData extends Record<string, unknown> = Record<string, unknown>>(
    accessToken: string,
    value: string,
    options?: EgovCallOptions,
  ): Promise<EverifyQrCheckResponse<TData>>;
  verifyPersonalInformation(
    accessToken: string,
    request: EverifyPersonalInformationRequest,
    options?: EgovCallOptions,
  ): Promise<EverifyVerificationResponse>;
  verifyQr(
    accessToken: string,
    request: EverifyQrVerifyRequest,
    options?: EgovCallOptions,
  ): Promise<EverifyVerificationResponse>;
}

export interface EverifyEnvironmentClient extends Omit<EverifyClient, "authenticate"> {
  authenticate(options?: EgovCallOptions): Promise<EverifyAuthenticationResponse>;
  readonly publicKey: string;
}

export interface EverifyEnvironmentClientOptions extends EgovTransportOptions {
  env?: EgovEnvironment;
}

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

function bearerHeaders(accessToken: string, options?: EgovCallOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  return headers;
}

export function createEverifyClient(options: EgovTransportOptions): EverifyClient {
  const transport: EgovTransport = createEgovTransport(options);

  return {
    authenticate(credentials, callOptions) {
      return transport.request<EverifyAuthenticationResponse>({
        body: {
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        },
        headers: new Headers(callOptions?.headers),
        method: "POST",
        path: "/api/auth",
        ...withSignal(callOptions),
      });
    },
    checkQr<TData extends Record<string, unknown> = Record<string, unknown>>(
      accessToken: string,
      value: string,
      callOptions?: EgovCallOptions,
    ) {
      return transport.request<EverifyQrCheckResponse<TData>>({
        body: { value },
        headers: bearerHeaders(accessToken, callOptions),
        method: "POST",
        path: "/api/query/qr/check",
        ...withSignal(callOptions),
      });
    },
    verifyPersonalInformation(accessToken, request, callOptions) {
      return transport.request<EverifyVerificationResponse>({
        body: {
          birth_date: request.birthDate,
          face_liveness_session_id: request.faceLivenessSessionId,
          first_name: request.firstName,
          last_name: request.lastName,
          middle_name: request.middleName,
          suffix: request.suffix,
        },
        headers: bearerHeaders(accessToken, callOptions),
        method: "POST",
        path: "/api/query",
        ...withSignal(callOptions),
      });
    },
    verifyQr(accessToken, request, callOptions) {
      return transport.request<EverifyVerificationResponse>({
        body: {
          face_liveness_session_id: request.faceLivenessSessionId,
          value: request.value,
        },
        headers: bearerHeaders(accessToken, callOptions),
        method: "POST",
        path: "/api/query/qr",
        ...withSignal(callOptions),
      });
    },
  };
}

export function createEverifyClientFromEnv(
  options: EverifyEnvironmentClientOptions,
): EverifyEnvironmentClient {
  const credentials = {
    clientId: requireEgovEnvironment("EVERIFY_CLIENT_ID", options.env),
    clientSecret: requireEgovEnvironment("EVERIFY_CLIENT_SECRET", options.env),
  };
  const publicKey = requireEgovEnvironment("EVERIFY_PUBKEY", options.env);
  const client = createEverifyClient({
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });

  return {
    authenticate(callOptions) {
      return client.authenticate(credentials, callOptions);
    },
    checkQr: client.checkQr,
    publicKey,
    verifyPersonalInformation: client.verifyPersonalInformation,
    verifyQr: client.verifyQr,
  };
}

export const everifyCatalog = defineEgovCatalog({
  endpoints: [
    {
      body: {
        fields: [
          { name: "client_id", required: true, type: "string" },
          { name: "client_secret", required: true, type: "string" },
        ],
      },
      description: "Generate a server-to-server access token for NIDAS eVerify.",
      id: "authenticate",
      method: "POST",
      name: "Authenticate (Generate Access Token)",
      parameters: [],
      path: "/api/auth",
      responses: [
        { description: "Access token generated.", status: 200 },
        { description: "Invalid client credentials.", status: 403 },
      ],
    },
    {
      body: {
        fields: [
          { name: "first_name", required: true, type: "string" },
          { name: "middle_name", required: false, type: "string" },
          { name: "last_name", required: true, type: "string" },
          { name: "suffix", required: false, type: "string" },
          { name: "birth_date", required: true, type: "string (YYYY-MM-DD)" },
          {
            description: "Session ID returned by the Face Liveness Web SDK.",
            name: "face_liveness_session_id",
            required: true,
            type: "UUID",
          },
        ],
      },
      description: "Compare demographic input and face liveness against NIDAS.",
      id: "verify-personal-information",
      method: "POST",
      name: "Verify Personal Information",
      parameters: [
        {
          location: "header",
          name: "Authorization",
          required: true,
          type: "Bearer token",
        },
      ],
      path: "/api/query",
      responses: [
        { description: "Verification result.", status: 200 },
        { description: "Missing, invalid, or expired access token.", status: 401 },
      ],
    },
    {
      body: {
        fields: [
          {
            description: "Raw value scanned from the National ID QR code.",
            name: "value",
            required: true,
            type: "string",
          },
        ],
      },
      description: "Decode and validate a National ID QR value.",
      id: "qr-check",
      method: "POST",
      name: "QR Check",
      parameters: [
        {
          location: "header",
          name: "Authorization",
          required: true,
          type: "Bearer token",
        },
      ],
      path: "/api/query/qr/check",
      responses: [
        { description: "Decoded QR profile data.", status: 200 },
        { description: "Invalid QR code format.", status: 422 },
      ],
    },
    {
      body: {
        fields: [
          { name: "value", required: true, type: "string" },
          { name: "face_liveness_session_id", required: true, type: "UUID" },
        ],
      },
      description: "Verify a National ID QR value against face liveness biometrics.",
      id: "qr-verify",
      method: "POST",
      name: "QR Verify",
      parameters: [
        {
          location: "header",
          name: "Authorization",
          required: true,
          type: "Bearer token",
        },
      ],
      path: "/api/query/qr",
      responses: [{ description: "Matched or unverified identity result.", status: 200 }],
    },
  ],
  id: "everify",
  name: "eVerify",
  slug: "everify",
  sourceUrl: EVERIFY_SOURCE_URL,
  summary: "Verify citizen identity against PhilSys with consent and face liveness.",
});

export const eVerifyApi = Object.freeze({
  catalog: everifyCatalog,
  create: createEverifyClient,
  fromEnv: createEverifyClientFromEnv,
});
