import { createEgovPayClient, createEgovPayClientFromEnv, egovPayCatalog } from "./api.js";

export * from "./api.js";
export type * from "./types.js";

export const eGovPayApi = Object.freeze({
  catalog: egovPayCatalog,
  create: createEgovPayClient,
  fromEnv: createEgovPayClientFromEnv,
});
