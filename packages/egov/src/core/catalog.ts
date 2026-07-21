import type { EgovHttpMethod } from "./types.js";

export type EgovCatalogParameterLocation = "header" | "path" | "query";

export interface EgovCatalogParameter {
  description?: string;
  location: EgovCatalogParameterLocation;
  name: string;
  required: boolean;
  type: string;
}

export interface EgovCatalogBodyField {
  description?: string;
  name: string;
  required: boolean;
  type: string;
}

export interface EgovCatalogResponse {
  description: string;
  example?: unknown;
  status: number | string;
}

export interface EgovCatalogEndpoint {
  body?: {
    example?: unknown;
    fields: readonly EgovCatalogBodyField[];
  };
  description: string;
  id: string;
  method: EgovHttpMethod;
  name: string;
  parameters: readonly EgovCatalogParameter[];
  path: string;
  responses: readonly EgovCatalogResponse[];
  rpcMethod?: string;
}

export interface EgovCatalogService {
  endpoints: readonly EgovCatalogEndpoint[];
  id: string;
  name: string;
  slug: string;
  sourceUrl: string;
  summary: string;
}

export function defineEgovCatalog<const TCatalog extends EgovCatalogService>(
  catalog: TCatalog,
): TCatalog {
  return catalog;
}
