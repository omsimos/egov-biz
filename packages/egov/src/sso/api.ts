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
  educational_background: string;
  from: string;
  level: string;
  school: string;
  to: string;
}

export interface EgovSsoAdditionalInformation {
  birth_place?: {
    birth_country: string;
    birth_municipality: string;
    birth_province: string;
  };
  educational_attainment?: EgovSsoEducationalAttainment[];
  emergency_information?: {
    emergency_contact: string;
    emergency_name: string;
    emergency_relationship: string;
  };
  expected_salary?: { expected_salary: string };
  father_details?: {
    father_birthdate: string;
    father_firstname: string;
    father_lastname: string;
  };
  health_data?: {
    complexion: string;
    eyes_color: string;
    height: string;
    weight: string;
  };
  industry?: { industry: string };
  mother_details?: {
    mother_birthdate: string;
    mother_maiden_firstname: string;
    mother_maiden_lastname: string;
    mother_maiden_middlename: string;
  };
  occupation?: { occupation: string };
  other_personal_information?: {
    marital_status: string;
    religion: string;
  };
  [key: string]: unknown;
}

export interface EgovSsoPassport {
  birth_date: string;
  expiry_date: string;
  first_name: string;
  gender: string;
  issued_date: string;
  last_name: string;
  middle_name: string;
  passport_number: string;
  place_issued: string;
  suffix: string | null;
}

export interface EgovSsoNationalId {
  code: string;
  face_url: string;
  pcn: string;
  signature: string | null;
}

export interface EgovSsoCitizenProfile {
  additional_information: EgovSsoAdditionalInformation;
  address: string;
  address_line_2: string | null;
  barangay: string;
  barangay_code: string;
  birth_date: string;
  country: string;
  country_alpha_2_code: string;
  country_alpha_3_code: string;
  country_id: number;
  email: string;
  first_name: string;
  foreign_address: unknown | null;
  gender: string;
  last_name: string;
  middle_name: string;
  mobile: string;
  municipality: string;
  municipality_code: string;
  national_id: EgovSsoNationalId | null;
  nationality: string;
  passport: EgovSsoPassport | null;
  photo: string;
  postal: string | null;
  province: string;
  province_code: string;
  region: string;
  region_code: string;
  signature: string | null;
  signature_url: string | null;
  street: string;
  suffix: string | null;
  tin_id: unknown | null;
  uniqid: string;
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

export const SsoApi = Object.freeze({
  catalog: egovSsoCatalog,
  create: createEgovSsoClient,
  fromEnv: createEgovSsoClientFromEnv,
});
