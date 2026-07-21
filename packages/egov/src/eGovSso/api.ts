import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import { requireEgovEnvironment, type EgovEnvironment } from "../core/env.js";
import type { EgovCallOptions, EgovTransport, EgovTransportOptions } from "../core/types.js";

export const EGOV_SSO_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/egov-sso" as const;

export interface EgovSsoTokenRequest {
  exchangeCode: string;
  partnerCode: string;
  partnerSecret: string;
  scope: "SSO_AUTHENTICATION" | (string & {});
}

export interface EgovSsoTokenResponse {
  access_token: string;
}

export interface EgovSsoEducationalAttainment {
  educational_background?: string | null;
  from?: string | null;
  level?: string | null;
  school?: string | null;
  to?: string | null;
}

export interface EgovSsoAdditionalInformation {
  birth_place?: {
    birth_country?: string | null;
    birth_municipality?: string | null;
    birth_province?: string | null;
  } | null;
  educational_attainment?: EgovSsoEducationalAttainment[] | null;
  emergency_information?: {
    emergency_contact?: string | null;
    emergency_name?: string | null;
    emergency_relationship?: string | null;
  } | null;
  expected_salary?: { expected_salary?: string | null } | null;
  father_details?: {
    father_birthdate?: string | null;
    father_firstname?: string | null;
    father_lastname?: string | null;
  } | null;
  health_data?: {
    complexion?: string | null;
    eyes_color?: string | null;
    height?: string | null;
    weight?: string | null;
  } | null;
  industry?: { industry?: string | null } | null;
  mother_details?: {
    mother_birthdate?: string | null;
    mother_maiden_firstname?: string | null;
    mother_maiden_lastname?: string | null;
    mother_maiden_middlename?: string | null;
  } | null;
  occupation?: { occupation?: string | null } | null;
  other_personal_information?: {
    marital_status?: string | null;
    religion?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface EgovSsoPassport {
  birth_date?: string | null;
  expiry_date?: string | null;
  first_name?: string | null;
  gender?: string | null;
  issued_date?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  passport_number?: string | null;
  place_issued?: string | null;
  suffix?: string | null;
}

export interface EgovSsoNationalId {
  code?: string | null;
  face_url?: string | null;
  pcn?: string | null;
  signature?: string | null;
}

export interface EgovSsoCitizenProfile {
  additional_information?: EgovSsoAdditionalInformation | null;
  address?: string | null;
  address_line_2?: string | null;
  barangay?: string | null;
  barangay_code?: string | null;
  birth_date?: string | null;
  country?: string | null;
  country_alpha_2_code?: string | null;
  country_alpha_3_code?: string | null;
  country_id?: number | null;
  email?: string | null;
  first_name?: string | null;
  foreign_address?: unknown | null;
  gender?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  mobile?: string | null;
  municipality?: string | null;
  municipality_code?: string | null;
  national_id?: EgovSsoNationalId | null;
  nationality?: string | null;
  passport?: EgovSsoPassport | null;
  photo?: string | null;
  postal?: string | null;
  province?: string | null;
  province_code?: string | null;
  region?: string | null;
  region_code?: string | null;
  signature?: string | null;
  signature_url?: string | null;
  street?: string | null;
  suffix?: string | null;
  tin_id?: unknown | null;
  uniqid?: string | null;
}

export interface EgovSsoAuthenticationResponse {
  data: EgovSsoCitizenProfile;
  message: string;
  status: number;
}

export interface EgovSsoClient {
  authenticate(
    accessToken: string,
    options?: EgovCallOptions,
  ): Promise<EgovSsoAuthenticationResponse>;
  generateAccessToken(
    request: EgovSsoTokenRequest,
    options?: EgovCallOptions,
  ): Promise<EgovSsoTokenResponse>;
}

export interface EgovSsoEnvironmentTokenRequest {
  exchangeCode: string;
  scope: EgovSsoTokenRequest["scope"];
}

export interface EgovSsoEnvironmentClient {
  authenticate: EgovSsoClient["authenticate"];
  generateAccessToken(
    request: EgovSsoEnvironmentTokenRequest,
    options?: EgovCallOptions,
  ): Promise<EgovSsoTokenResponse>;
}

export interface EgovSsoEnvironmentClientOptions extends EgovTransportOptions {
  env?: EgovEnvironment;
}

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

export function createEgovSsoClient(options: EgovTransportOptions): EgovSsoClient {
  const transport: EgovTransport = createEgovTransport(options);

  return {
    authenticate(accessToken, callOptions) {
      const headers = new Headers(callOptions?.headers);
      headers.set("authorization", `Bearer ${accessToken}`);

      return transport.request<EgovSsoAuthenticationResponse>({
        headers,
        method: "POST",
        path: "/api/partner/sso_authentication",
        ...withSignal(callOptions),
      });
    },
    generateAccessToken(request, callOptions) {
      return transport.request<EgovSsoTokenResponse>({
        body: {
          exchange_code: request.exchangeCode,
          partner_code: request.partnerCode,
          partner_secret: request.partnerSecret,
          scope: request.scope,
        },
        headers: new Headers(callOptions?.headers),
        method: "POST",
        path: "/api/token",
        ...withSignal(callOptions),
      });
    },
  };
}

export function createEgovSsoClientFromEnv(
  options: EgovSsoEnvironmentClientOptions,
): EgovSsoEnvironmentClient {
  const partnerCode = requireEgovEnvironment("EGOVSSO_PARTNER_CODE", options.env);
  const partnerSecret = requireEgovEnvironment("EGOVSSO_PARTNER_SECRET", options.env);
  const client = createEgovSsoClient({
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });

  return {
    authenticate: client.authenticate,
    generateAccessToken(request, callOptions) {
      return client.generateAccessToken(
        {
          exchangeCode: request.exchangeCode,
          partnerCode,
          partnerSecret,
          scope: request.scope,
        },
        callOptions,
      );
    },
  };
}

export const egovSsoCatalog = defineEgovCatalog({
  endpoints: [
    {
      body: {
        example: {
          exchange_code: "generated_exchange_code",
          partner_code: "{{partner_code}}",
          partner_secret: "{{partner_secret}}",
          scope: "SSO_AUTHENTICATION",
        },
        fields: [
          {
            description: "Single-use authorization code received after user authentication.",
            name: "exchange_code",
            required: true,
            type: "string",
          },
          {
            description: "Requested SSO scope.",
            name: "scope",
            required: true,
            type: "string",
          },
          {
            description: "Partner or agency code.",
            name: "partner_code",
            required: true,
            type: "string",
          },
          {
            description: "Server-side partner secret.",
            name: "partner_secret",
            required: true,
            type: "string",
          },
        ],
      },
      description: "Exchange a short-lived authorization code for an SSO access token.",
      id: "generate-access-token",
      method: "POST",
      name: "Generates Access Token",
      parameters: [],
      path: "/api/token",
      responses: [
        { description: "Access token generated.", status: 200 },
        { description: "Partner credentials are invalid or unauthorized.", status: 403 },
        { description: "Exchange code is invalid, used, or expired.", status: 422 },
      ],
    },
    {
      description: "Resolve the authenticated citizen profile for a partner application.",
      id: "sso-authentication",
      method: "POST",
      name: "SSO Authentication",
      parameters: [
        {
          description: "Access token returned by POST /api/token.",
          location: "header",
          name: "Authorization",
          required: true,
          type: "Bearer token",
        },
      ],
      path: "/api/partner/sso_authentication",
      responses: [
        { description: "Authenticated citizen profile.", status: 200 },
        { description: "Access token is missing, invalid, or expired.", status: 401 },
      ],
    },
  ],
  id: "egov-sso",
  name: "eGov SSO",
  slug: "egov-sso",
  sourceUrl: EGOV_SSO_SOURCE_URL,
  summary: "Single Sign-On integration for eGov partners.",
});

export const eGovSsoApi = Object.freeze({
  catalog: egovSsoCatalog,
  create: createEgovSsoClient,
  fromEnv: createEgovSsoClientFromEnv,
});
