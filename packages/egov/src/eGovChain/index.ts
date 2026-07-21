import { createEgovChainClient, egovChainCatalog } from "./api.js";

export * from "./api.js";
export type * from "./types.js";

export const eGovChainApi = Object.freeze({
  catalog: egovChainCatalog,
  create: createEgovChainClient,
});
