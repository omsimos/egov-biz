import type { EgovCallOptions, EgovTransportOptions } from "../core/types.js";

export interface EReportDatasetRecord<TAttributes extends Record<string, unknown>> {
  attributes: TAttributes;
  id: string;
  type: string;
}

export interface EReportPagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface EReportDatasetListResponse<TAttributes extends Record<string, unknown>> {
  data: Array<EReportDatasetRecord<TAttributes>>;
  jsonapi?: { version: string };
  meta?: { pagination: EReportPagination };
}

export interface EReportReportTypeAttributes extends Record<string, unknown> {
  code: string;
  name: string;
}

export interface EReportLocationAttributes extends Record<string, unknown> {
  name: string;
}

export interface EReportGenerateTokenResponse {
  access_token: string;
  expires_at: string;
}

export interface EReportSubmitComplaintRequest {
  barangayCode: string;
  complainantEmail: string;
  evidences?: string[];
  firstName: string;
  gender: string;
  lastName: string;
  latitude?: string;
  longitude?: string;
  message: string;
  mobile: string;
  municipalityCode: string;
  provinceCode: string;
  regionCode: string;
  reportType: string;
  subject: string;
}

export interface EReportSubmitComplaintResponse {
  case_number: string;
  code: number;
  message: string;
}

export interface EReportRequestOtpResponse {
  already_verified: boolean;
  code: number;
  message: string;
}

export interface EReportConfirmOtpRequest {
  email: string;
  otp: string;
}

export interface EReportConfirmOtpResponse {
  code: number;
  expires_at: string;
  report_view_token: string;
}

export interface EReportListReportsQuery {
  limit?: number;
  page?: number;
  q?: string;
}

export interface EReportRecord extends Record<string, unknown> {
  case_number?: string;
}

export interface EReportReportsResponse {
  data: EReportRecord[];
  meta?: { pagination?: EReportPagination } & Record<string, unknown>;
}

export interface EReportReportResponse {
  data: EReportRecord;
}

export interface EReportClient {
  confirmOtp(
    integrationToken: string,
    request: EReportConfirmOtpRequest,
    options?: EgovCallOptions,
  ): Promise<EReportConfirmOtpResponse>;
  generateToken(
    accessCode: string,
    options?: EgovCallOptions,
  ): Promise<EReportGenerateTokenResponse>;
  getReport(
    reportViewToken: string,
    caseNumber: string,
    options?: EgovCallOptions,
  ): Promise<EReportReportResponse>;
  listBarangays(
    integrationToken: string,
    municipalityCode: string,
    options?: EgovCallOptions,
  ): Promise<EReportDatasetListResponse<EReportLocationAttributes>>;
  listMunicipalities(
    integrationToken: string,
    provinceCode: string,
    options?: EgovCallOptions,
  ): Promise<EReportDatasetListResponse<EReportLocationAttributes>>;
  listProvinces(
    integrationToken: string,
    regionCode: string,
    options?: EgovCallOptions,
  ): Promise<EReportDatasetListResponse<EReportLocationAttributes>>;
  listRegions(
    integrationToken: string,
    options?: EgovCallOptions,
  ): Promise<EReportDatasetListResponse<EReportLocationAttributes>>;
  listReports(
    reportViewToken: string,
    query?: EReportListReportsQuery,
    options?: EgovCallOptions,
  ): Promise<EReportReportsResponse>;
  listReportTypes(
    integrationToken: string,
    options?: EgovCallOptions,
  ): Promise<EReportDatasetListResponse<EReportReportTypeAttributes>>;
  requestOtp(
    integrationToken: string,
    email: string,
    options?: EgovCallOptions,
  ): Promise<EReportRequestOtpResponse>;
  submitComplaint(
    integrationToken: string,
    request: EReportSubmitComplaintRequest,
    options?: EgovCallOptions,
  ): Promise<EReportSubmitComplaintResponse>;
}

export interface EReportEnvironmentClient extends Omit<EReportClient, "generateToken"> {
  generateToken(options?: EgovCallOptions): Promise<EReportGenerateTokenResponse>;
}

export interface EReportEnvironmentClientOptions extends EgovTransportOptions {
  env?: import("../core/env.js").EgovEnvironment;
}
