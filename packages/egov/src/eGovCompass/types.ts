import type { EgovCallOptions, EgovTransportOptions } from "../core/types.js";

export type CompassPeriod = "FY" | "Q1" | "Q2" | "Q3" | "Q4";
export type CompassExpenseClass = "CO" | "FINEX" | "MOOE" | "PS";
export type CompassSheetScope = "agency" | "sucs" | "summary";
export type CompassLgsfProgramCode = "FALGU" | "GEF" | "GGG" | "SAFPB" | "SBDP";

export interface CompassPaginationQuery {
  limit?: number;
  page?: number;
}

export interface CompassSaaodbRecordsQuery extends CompassPaginationQuery {
  class?: CompassExpenseClass;
  entityName?: string;
  period: CompassPeriod;
  reportYear: number;
  sheetScope?: CompassSheetScope;
}

export interface CompassSaaodbRecord extends Record<string, unknown> {
  adjustments?: number;
  allotments?: number;
  appropriations?: number;
  class?: CompassExpenseClass;
  disbursements?: number;
  entityName?: string;
  id?: string;
  obligations?: number;
  period?: CompassPeriod;
  reportYear?: number;
  sheetScope?: CompassSheetScope;
}

export interface CompassPaginatedResponse<T> {
  items: T[];
  limit: number;
  page: number;
  total: number;
}

export interface CompassSaaodbDashboardQuery {
  reportYear: number;
  sheetScope: CompassSheetScope;
}

export interface CompassSaaodbDashboardResponse {
  appropriationSplit: {
    continuing: number;
    currentYear: number;
    hasSplit: boolean;
  };
  cascade: {
    adjustments: number;
    allotments: number;
    appropriations: number;
    disbursements: number;
    obligations: number;
    totalAvailable: number;
    unobligated: number;
    unreleased: number;
  };
  classBreakdown: Array<{ amount: number; class: CompassExpenseClass }>;
  rates: {
    disbRateAppro: number;
    disbRateOblig: number;
    obligationRate: number;
  };
  reportYear: number;
  sheetScope: CompassSheetScope;
  topEntities: Array<Record<string, unknown>>;
}

export interface CompassSaaodbEntitiesQuery {
  expandEntity?: string;
  expandEntityParent?: string;
  expandParent?: string;
  reportYear: number;
  sheetScope: "agency" | "sucs";
}

export type CompassSaaodbEntitiesResponse = Record<string, unknown>;

export interface CompassNcaRecordsQuery extends CompassPaginationQuery {
  agencyCode?: string;
  budgetYear: number;
  deptCode?: string;
  expenseClass?: string;
  operatingUnitCode?: string;
}

export type CompassNcaRecord = Record<string, unknown>;

export interface CompassSaroRecordsQuery extends CompassPaginationQuery {
  agencyCode?: string;
  deptCode?: string;
  expenseClass?: string;
  saroNo?: string;
}

export interface CompassSaroRecord extends Record<string, unknown> {
  agencyCode?: string;
  amount?: number;
  dateIssued?: string;
  deptCode?: string;
  expenseClass?: string;
  saroNo?: string;
}

export interface CompassLgsfRecordsQuery extends CompassPaginationQuery {
  cityMunicipality?: string;
  fiscalYear?: number;
  programCode?: CompassLgsfProgramCode;
  province?: string;
  regionCode?: string;
}

export type CompassLgsfRecord = Record<string, unknown>;

export interface CompassLgsfDashboardQuery extends CompassPaginationQuery {
  municipality?: string;
  programCode: CompassLgsfProgramCode;
  province?: string;
  region?: string;
  reportYear?: number;
}

export interface CompassLgsfDashboardResponse {
  kpis: {
    barangayCount: number;
    fiscalYearCount: number;
    lguCount: number;
    projectCount: number;
    provinceCount: number;
    regionCount: number;
    totalReleased: number;
  };
  programCode: CompassLgsfProgramCode;
  projects: {
    page: number;
    pageSize: number;
    rows: CompassLgsfRecord[];
    total: number;
  };
  reportYear: number | null;
  trend: Array<Record<string, unknown>>;
}

export interface CompassClient {
  getLgsfDashboard(
    query: CompassLgsfDashboardQuery,
    options?: EgovCallOptions,
  ): Promise<CompassLgsfDashboardResponse>;
  getLgsfRecords(
    query?: CompassLgsfRecordsQuery,
    options?: EgovCallOptions,
  ): Promise<CompassPaginatedResponse<CompassLgsfRecord>>;
  getNcaRecords(
    query: CompassNcaRecordsQuery,
    options?: EgovCallOptions,
  ): Promise<CompassPaginatedResponse<CompassNcaRecord>>;
  getSaaodbDashboard(
    query: CompassSaaodbDashboardQuery,
    options?: EgovCallOptions,
  ): Promise<CompassSaaodbDashboardResponse>;
  getSaaodbEntities(
    query: CompassSaaodbEntitiesQuery,
    options?: EgovCallOptions,
  ): Promise<CompassSaaodbEntitiesResponse>;
  getSaaodbRecords(
    query: CompassSaaodbRecordsQuery,
    options?: EgovCallOptions,
  ): Promise<CompassPaginatedResponse<CompassSaaodbRecord>>;
  getSaroRecords(
    query?: CompassSaroRecordsQuery,
    options?: EgovCallOptions,
  ): Promise<CompassPaginatedResponse<CompassSaroRecord>>;
}

export interface CompassClientOptions extends EgovTransportOptions {
  apiKey: string;
}

export interface CompassEnvironmentClientOptions extends EgovTransportOptions {
  env?: import("../core/env.js").EgovEnvironment;
}
