import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import { requireEgovEnvironment } from "../core/env.js";
import type { EgovCallOptions } from "../core/types.js";
import type {
  CompassClient,
  CompassClientOptions,
  CompassEnvironmentClientOptions,
  CompassLgsfDashboardResponse,
  CompassLgsfRecord,
  CompassNcaRecord,
  CompassPaginatedResponse,
  CompassSaaodbDashboardResponse,
  CompassSaaodbEntitiesResponse,
  CompassSaaodbRecord,
  CompassSaroRecord,
} from "./types.js";

export const COMPASS_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/compass" as const;

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

function apiHeaders(apiKey: string, options?: EgovCallOptions): Headers {
  const headers = new Headers(options?.headers);
  headers.set("x-api-key", apiKey);
  return headers;
}

export function createCompassClient(options: CompassClientOptions): CompassClient {
  const transport = createEgovTransport(options);
  const headers = (callOptions?: EgovCallOptions) => apiHeaders(options.apiKey, callOptions);

  return {
    getLgsfDashboard(query, callOptions) {
      return transport.request<CompassLgsfDashboardResponse>({
        headers: headers(callOptions),
        method: "GET",
        path: "/api/v1/records/lgsf/dashboard",
        query: {
          limit: query.limit,
          municipality: query.municipality,
          page: query.page,
          programCode: query.programCode,
          province: query.province,
          region: query.region,
          reportYear: query.reportYear,
        },
        ...withSignal(callOptions),
      });
    },
    getLgsfRecords(query, callOptions) {
      return transport.request<CompassPaginatedResponse<CompassLgsfRecord>>({
        headers: headers(callOptions),
        method: "GET",
        path: "/api/v1/records/lgsf",
        query: {
          cityMunicipality: query?.cityMunicipality,
          fiscalYear: query?.fiscalYear,
          limit: query?.limit,
          page: query?.page,
          programCode: query?.programCode,
          province: query?.province,
          regionCode: query?.regionCode,
        },
        ...withSignal(callOptions),
      });
    },
    getNcaRecords(query, callOptions) {
      return transport.request<CompassPaginatedResponse<CompassNcaRecord>>({
        headers: headers(callOptions),
        method: "GET",
        path: "/api/v1/records/nca",
        query: {
          agencyCode: query.agencyCode,
          budgetYear: query.budgetYear,
          deptCode: query.deptCode,
          expenseClass: query.expenseClass,
          limit: query.limit,
          operatingUnitCode: query.operatingUnitCode,
          page: query.page,
        },
        ...withSignal(callOptions),
      });
    },
    getSaaodbDashboard(query, callOptions) {
      return transport.request<CompassSaaodbDashboardResponse>({
        headers: headers(callOptions),
        method: "GET",
        path: "/api/v1/records/saaodb/dashboard",
        query: {
          reportYear: query.reportYear,
          sheetScope: query.sheetScope,
        },
        ...withSignal(callOptions),
      });
    },
    getSaaodbEntities(query, callOptions) {
      return transport.request<CompassSaaodbEntitiesResponse>({
        headers: headers(callOptions),
        method: "GET",
        path: "/api/v1/records/saaodb/entities",
        query: {
          expandEntity: query.expandEntity,
          expandEntityParent: query.expandEntityParent,
          expandParent: query.expandParent,
          reportYear: query.reportYear,
          sheetScope: query.sheetScope,
        },
        ...withSignal(callOptions),
      });
    },
    getSaaodbRecords(query, callOptions) {
      return transport.request<CompassPaginatedResponse<CompassSaaodbRecord>>({
        headers: headers(callOptions),
        method: "GET",
        path: "/api/v1/records/saaodb",
        query: {
          class: query.class,
          entityName: query.entityName,
          limit: query.limit,
          page: query.page,
          period: query.period,
          reportYear: query.reportYear,
          sheetScope: query.sheetScope,
        },
        ...withSignal(callOptions),
      });
    },
    getSaroRecords(query, callOptions) {
      return transport.request<CompassPaginatedResponse<CompassSaroRecord>>({
        headers: headers(callOptions),
        method: "GET",
        path: "/api/v1/records/saro",
        query: {
          agencyCode: query?.agencyCode,
          deptCode: query?.deptCode,
          expenseClass: query?.expenseClass,
          limit: query?.limit,
          page: query?.page,
          saroNo: query?.saroNo,
        },
        ...withSignal(callOptions),
      });
    },
  };
}

export function createCompassClientFromEnv(
  options: CompassEnvironmentClientOptions,
): CompassClient {
  return createCompassClient({
    apiKey: requireEgovEnvironment("EGOVCOMPASS_API_KEY", options.env),
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });
}

const apiKeyParameter = {
  location: "header",
  name: "X-API-Key",
  required: true,
  type: "string",
} as const;

const paginationParameters = [
  { location: "query", name: "page", required: false, type: "integer" },
  { location: "query", name: "limit", required: false, type: "integer" },
] as const;

export const compassCatalog = defineEgovCatalog({
  endpoints: [
    {
      description: "Return paginated SAAODB budget-execution records.",
      id: "get-saaodb-records",
      method: "GET",
      name: "Get SAAODB Records",
      parameters: [
        apiKeyParameter,
        { location: "query", name: "reportYear", required: true, type: "integer" },
        { location: "query", name: "period", required: true, type: "Q1 | Q2 | Q3 | Q4 | FY" },
        { location: "query", name: "class", required: false, type: "PS | MOOE | FINEX | CO" },
        { location: "query", name: "sheetScope", required: false, type: "summary | agency | sucs" },
        { location: "query", name: "entityName", required: false, type: "string" },
        ...paginationParameters,
      ],
      path: "/api/v1/records/saaodb",
      responses: [{ description: "SAAODB records returned.", status: 200 }],
    },
    {
      description: "Return aggregated SAAODB budget-execution figures.",
      id: "get-saaodb-dashboard-summary",
      method: "GET",
      name: "Get SAAODB Dashboard Summary",
      parameters: [
        apiKeyParameter,
        { location: "query", name: "reportYear", required: true, type: "integer" },
        { location: "query", name: "sheetScope", required: true, type: "summary | agency | sucs" },
      ],
      path: "/api/v1/records/saaodb/dashboard",
      responses: [{ description: "SAAODB dashboard returned.", status: 200 }],
    },
    {
      description: "Navigate SAAODB department, agency, and fund-source relationships.",
      id: "get-saaodb-hierarchical-entities",
      method: "GET",
      name: "Get SAAODB Hierarchical Entities",
      parameters: [
        apiKeyParameter,
        { location: "query", name: "reportYear", required: true, type: "integer" },
        { location: "query", name: "sheetScope", required: true, type: "agency | sucs" },
        { location: "query", name: "expandParent", required: false, type: "string" },
        { location: "query", name: "expandEntity", required: false, type: "string" },
        { location: "query", name: "expandEntityParent", required: false, type: "string" },
      ],
      path: "/api/v1/records/saaodb/entities",
      responses: [{ description: "Entity hierarchy returned.", status: 200 }],
    },
    {
      description: "Return paginated Notice of Cash Allocation records.",
      id: "get-nca-records",
      method: "GET",
      name: "Get NCA Records",
      parameters: [
        apiKeyParameter,
        { location: "query", name: "budgetYear", required: true, type: "integer" },
        { location: "query", name: "deptCode", required: false, type: "string" },
        { location: "query", name: "agencyCode", required: false, type: "string" },
        { location: "query", name: "operatingUnitCode", required: false, type: "string" },
        { location: "query", name: "expenseClass", required: false, type: "string" },
        ...paginationParameters,
      ],
      path: "/api/v1/records/nca",
      responses: [{ description: "NCA records returned.", status: 200 }],
    },
    {
      description: "Return paginated Special Allotment Release Order records.",
      id: "get-saro-records",
      method: "GET",
      name: "Get SARO Records",
      parameters: [
        apiKeyParameter,
        { location: "query", name: "saroNo", required: false, type: "string" },
        { location: "query", name: "deptCode", required: false, type: "string" },
        { location: "query", name: "agencyCode", required: false, type: "string" },
        { location: "query", name: "expenseClass", required: false, type: "string" },
        ...paginationParameters,
      ],
      path: "/api/v1/records/saro",
      responses: [{ description: "SARO records returned.", status: 200 }],
    },
    {
      description: "Return paginated Local Government Support Fund records.",
      id: "get-lgsf-records",
      method: "GET",
      name: "Get LGSF Records",
      parameters: [
        apiKeyParameter,
        { location: "query", name: "fiscalYear", required: false, type: "integer" },
        {
          location: "query",
          name: "programCode",
          required: false,
          type: "FALGU | GEF | GGG | SBDP | SAFPB",
        },
        { location: "query", name: "regionCode", required: false, type: "string" },
        { location: "query", name: "province", required: false, type: "string" },
        { location: "query", name: "cityMunicipality", required: false, type: "string" },
        ...paginationParameters,
      ],
      path: "/api/v1/records/lgsf",
      responses: [{ description: "LGSF records returned.", status: 200 }],
    },
    {
      description: "Return LGSF KPIs, trends, and a paginated project list.",
      id: "get-lgsf-dashboard-summary",
      method: "GET",
      name: "Get LGSF Dashboard Summary",
      parameters: [
        apiKeyParameter,
        {
          location: "query",
          name: "programCode",
          required: true,
          type: "FALGU | GEF | GGG | SBDP | SAFPB",
        },
        { location: "query", name: "reportYear", required: false, type: "integer" },
        { location: "query", name: "region", required: false, type: "string" },
        { location: "query", name: "province", required: false, type: "string" },
        { location: "query", name: "municipality", required: false, type: "string" },
        ...paginationParameters,
      ],
      path: "/api/v1/records/lgsf/dashboard",
      responses: [{ description: "LGSF dashboard returned.", status: 200 }],
    },
  ],
  id: "compass",
  name: "Compass",
  slug: "compass",
  sourceUrl: COMPASS_SOURCE_URL,
  summary: "Query public DBM appropriations, allotment, release, and spending records.",
});

export const eGovCompassApi = Object.freeze({
  catalog: compassCatalog,
  create: createCompassClient,
  fromEnv: createCompassClientFromEnv,
});
