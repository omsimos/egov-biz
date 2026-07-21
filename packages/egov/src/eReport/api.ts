import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import { requireEgovEnvironment } from "../core/env.js";
import type { EgovCallOptions } from "../core/types.js";
import type {
  EReportClient,
  EReportConfirmOtpResponse,
  EReportDatasetListResponse,
  EReportEnvironmentClient,
  EReportEnvironmentClientOptions,
  EReportGenerateTokenResponse,
  EReportLocationAttributes,
  EReportReportResponse,
  EReportReportsResponse,
  EReportReportTypeAttributes,
  EReportRequestOtpResponse,
  EReportSubmitComplaintResponse,
} from "./types.js";

export const EREPORT_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/ereport" as const;

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

function bearerHeaders(token: string, options?: EgovCallOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set("authorization", `Bearer ${token}`);
  return headers;
}

function reportViewHeaders(token: string, options?: EgovCallOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set("x-ereport-view-token", token);
  return headers;
}

export function createEReportClient(options: EReportEnvironmentClientOptions): EReportClient {
  const transport = createEgovTransport(options);

  return {
    confirmOtp(integrationToken, request, callOptions) {
      return transport.request<EReportConfirmOtpResponse>({
        body: request,
        headers: bearerHeaders(integrationToken, callOptions),
        method: "POST",
        path: "/api/integration/verify/confirm",
        ...withSignal(callOptions),
      });
    },
    generateToken(accessCode, callOptions) {
      return transport.request<EReportGenerateTokenResponse>({
        body: { access_code: accessCode },
        method: "POST",
        path: "/api/integration/token",
        ...(callOptions?.headers === undefined ? {} : { headers: callOptions.headers }),
        ...withSignal(callOptions),
      });
    },
    getReport(reportViewToken, caseNumber, callOptions) {
      return transport.request<EReportReportResponse>({
        headers: reportViewHeaders(reportViewToken, callOptions),
        method: "GET",
        path: `/api/integration/reports/${encodeURIComponent(caseNumber)}`,
        ...withSignal(callOptions),
      });
    },
    listBarangays(integrationToken, municipalityCode, callOptions) {
      return transport.request<EReportDatasetListResponse<EReportLocationAttributes>>({
        headers: bearerHeaders(integrationToken, callOptions),
        method: "GET",
        path: "/api/integration/datasets/barangays",
        query: { municipality_code: municipalityCode },
        ...withSignal(callOptions),
      });
    },
    listMunicipalities(integrationToken, provinceCode, callOptions) {
      return transport.request<EReportDatasetListResponse<EReportLocationAttributes>>({
        headers: bearerHeaders(integrationToken, callOptions),
        method: "GET",
        path: "/api/integration/datasets/municipalities",
        query: { province_code: provinceCode },
        ...withSignal(callOptions),
      });
    },
    listProvinces(integrationToken, regionCode, callOptions) {
      return transport.request<EReportDatasetListResponse<EReportLocationAttributes>>({
        headers: bearerHeaders(integrationToken, callOptions),
        method: "GET",
        path: "/api/integration/datasets/provinces",
        query: { region_code: regionCode },
        ...withSignal(callOptions),
      });
    },
    listRegions(integrationToken, callOptions) {
      return transport.request<EReportDatasetListResponse<EReportLocationAttributes>>({
        headers: bearerHeaders(integrationToken, callOptions),
        method: "GET",
        path: "/api/integration/datasets/regions",
        ...withSignal(callOptions),
      });
    },
    listReports(reportViewToken, query, callOptions) {
      return transport.request<EReportReportsResponse>({
        headers: reportViewHeaders(reportViewToken, callOptions),
        method: "GET",
        path: "/api/integration/reports",
        query: { limit: query?.limit, page: query?.page, q: query?.q },
        ...withSignal(callOptions),
      });
    },
    listReportTypes(integrationToken, callOptions) {
      return transport.request<EReportDatasetListResponse<EReportReportTypeAttributes>>({
        headers: bearerHeaders(integrationToken, callOptions),
        method: "GET",
        path: "/api/integration/datasets/report_types",
        ...withSignal(callOptions),
      });
    },
    requestOtp(integrationToken, email, callOptions) {
      return transport.request<EReportRequestOtpResponse>({
        body: { email },
        headers: bearerHeaders(integrationToken, callOptions),
        method: "POST",
        path: "/api/integration/verify/request",
        ...withSignal(callOptions),
      });
    },
    submitComplaint(integrationToken, request, callOptions) {
      return transport.request<EReportSubmitComplaintResponse>({
        body: {
          barangay_code: request.barangayCode,
          complainant_email: request.complainantEmail,
          evidences: request.evidences,
          first_name: request.firstName,
          gender: request.gender,
          last_name: request.lastName,
          latitude: request.latitude,
          longitude: request.longitude,
          message: request.message,
          mobile: request.mobile,
          municipality_code: request.municipalityCode,
          province_code: request.provinceCode,
          region_code: request.regionCode,
          report_type: request.reportType,
          subject: request.subject,
        },
        headers: bearerHeaders(integrationToken, callOptions),
        method: "POST",
        path: "/api/integration/submit_complaint",
        ...withSignal(callOptions),
      });
    },
  };
}

export function createEReportClientFromEnv(
  options: EReportEnvironmentClientOptions,
): EReportEnvironmentClient {
  const accessCode = requireEgovEnvironment("EREPORT_ACCESS_TOKEN", options.env);
  const client = createEReportClient(options);

  return {
    ...client,
    generateToken(callOptions) {
      return client.generateToken(accessCode, callOptions);
    },
  };
}

const bearerParameter = {
  description: "Integration token returned by Generate Token.",
  location: "header",
  name: "Authorization",
  required: true,
  type: "Bearer token",
} as const;

const viewTokenParameter = {
  description: "Report view token returned by Confirm OTP.",
  location: "header",
  name: "X-EReport-View-Token",
  required: true,
  type: "string",
} as const;

export const eReportCatalog = defineEgovCatalog({
  endpoints: [
    {
      description: "Return the available complaint and report categories.",
      id: "report-type-list",
      method: "GET",
      name: "Report Type List",
      parameters: [bearerParameter],
      path: "/api/integration/datasets/report_types",
      responses: [{ description: "Report types returned.", status: 200 }],
    },
    {
      description: "Return the available regions.",
      id: "region-list",
      method: "GET",
      name: "Region List",
      parameters: [bearerParameter],
      path: "/api/integration/datasets/regions",
      responses: [{ description: "Regions returned.", status: 200 }],
    },
    {
      description: "Return provinces within a region.",
      id: "province-list",
      method: "GET",
      name: "Province List by Params",
      parameters: [
        bearerParameter,
        { location: "query", name: "region_code", required: true, type: "string" },
      ],
      path: "/api/integration/datasets/provinces",
      responses: [{ description: "Provinces returned.", status: 200 }],
    },
    {
      description: "Return municipalities within a province.",
      id: "municipality-list",
      method: "GET",
      name: "Municipality List by Params",
      parameters: [
        bearerParameter,
        { location: "query", name: "province_code", required: true, type: "string" },
      ],
      path: "/api/integration/datasets/municipalities",
      responses: [{ description: "Municipalities returned.", status: 200 }],
    },
    {
      description: "Return barangays within a municipality.",
      id: "barangay-list",
      method: "GET",
      name: "Barangay List by Params",
      parameters: [
        bearerParameter,
        { location: "query", name: "municipality_code", required: true, type: "string" },
      ],
      path: "/api/integration/datasets/barangays",
      responses: [{ description: "Barangays returned.", status: 200 }],
    },
    {
      body: {
        fields: [{ name: "access_code", required: true, type: "string" }],
      },
      description: "Exchange an integration access code for a bearer token.",
      id: "generate-token",
      method: "POST",
      name: "Generate Token",
      parameters: [],
      path: "/api/integration/token",
      responses: [{ description: "Integration token generated.", status: 200 }],
    },
    {
      body: {
        fields: [
          { name: "mobile", required: true, type: "string" },
          { name: "first_name", required: true, type: "string" },
          { name: "last_name", required: true, type: "string" },
          { name: "gender", required: true, type: "string" },
          { name: "complainant_email", required: true, type: "string" },
          { name: "report_type", required: true, type: "string" },
          { name: "subject", required: true, type: "string" },
          { name: "message", required: true, type: "string" },
          { name: "evidences", required: false, type: "string[]" },
          { name: "region_code", required: true, type: "string" },
          { name: "province_code", required: true, type: "string" },
          { name: "municipality_code", required: true, type: "string" },
          { name: "barangay_code", required: true, type: "string" },
          { name: "latitude", required: false, type: "string" },
          { name: "longitude", required: false, type: "string" },
        ],
      },
      description: "Submit a complaint and receive its case number.",
      id: "submit-complaint",
      method: "POST",
      name: "Submit Complaint",
      parameters: [bearerParameter],
      path: "/api/integration/submit_complaint",
      responses: [{ description: "Complaint accepted.", status: 200 }],
    },
    {
      body: { fields: [{ name: "email", required: true, type: "email" }] },
      description: "Send a six-digit verification code to an email address.",
      id: "request-otp",
      method: "POST",
      name: "Verify - Request OTP",
      parameters: [bearerParameter],
      path: "/api/integration/verify/request",
      responses: [{ description: "OTP dispatched.", status: 200 }],
    },
    {
      body: {
        fields: [
          { name: "email", required: true, type: "email" },
          { name: "otp", required: true, type: "string" },
        ],
      },
      description: "Confirm an OTP and receive a report-view token.",
      id: "confirm-otp",
      method: "POST",
      name: "Verify - Confirm OTP",
      parameters: [bearerParameter],
      path: "/api/integration/verify/confirm",
      responses: [{ description: "OTP confirmed and view token returned.", status: 200 }],
    },
    {
      description: "Search and paginate reports available to the verified user.",
      id: "reports-list",
      method: "GET",
      name: "Reports List",
      parameters: [
        viewTokenParameter,
        { location: "query", name: "q", required: false, type: "string" },
        { location: "query", name: "page", required: false, type: "number" },
        { location: "query", name: "limit", required: false, type: "number" },
      ],
      path: "/api/integration/reports",
      responses: [{ description: "Reports returned.", status: 200 }],
    },
    {
      description: "Return a report by its case number.",
      id: "view-report",
      method: "GET",
      name: "View Report by Case Number",
      parameters: [
        viewTokenParameter,
        { location: "path", name: "case_number", required: true, type: "string" },
      ],
      path: "/api/integration/reports/{case_number}",
      responses: [{ description: "Report returned.", status: 200 }],
    },
  ],
  id: "ereport",
  name: "eReport",
  slug: "ereport",
  sourceUrl: EREPORT_SOURCE_URL,
  summary: "Submit, verify, list, and track citizen complaints and reports.",
});

export const eReportApi = Object.freeze({
  catalog: eReportCatalog,
  create: createEReportClient,
  fromEnv: createEReportClientFromEnv,
});
