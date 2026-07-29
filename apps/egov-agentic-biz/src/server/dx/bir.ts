import { resolve } from "node:path";
import { createBirFormService, type BirFormService } from "@repo/dx/bir";
import { createFileStorage } from "@repo/utils/files";

const globalCache = globalThis as typeof globalThis & {
  __egovBizBir?: BirFormService;
};

function templatePath(environmentName: string, fallback: string) {
  return process.env[environmentName]?.trim() || resolve(process.cwd(), fallback);
}

function createBir(): BirFormService {
  return createBirFormService({
    storage: createFileStorage({ workingDirectory: process.cwd() }),
    templatePaths: {
      "1901": templatePath("BIR_FORM_1901_TEMPLATE_PATH", "public/forms/bir-form-1901.pdf"),
      "1905": templatePath("BIR_FORM_1905_TEMPLATE_PATH", "public/forms/bir-form-1905.pdf"),
    },
  });
}

/** Server-only composition root for owner-scoped DX BIR artifacts. */
export function getBir(): BirFormService {
  globalCache.__egovBizBir ??= createBir();
  return globalCache.__egovBizBir;
}
