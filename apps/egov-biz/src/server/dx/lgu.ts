import { createEgovPayClient } from "@repo/dx";
import {
  createDrizzleLguRepository,
  createEgovPayLguPaymentProvider,
  createLguService,
  type LguPaymentProvider,
  type LguService,
} from "@repo/dx/lgu";
import { createClient } from "egov.js";
import { getDxDatabase } from "@/server/dx/database";

const globalCache = globalThis as typeof globalThis & {
  __egovBizLgu?: LguService;
};

export function lguPaymentEnvironment(
  environment: Record<string, string | undefined> = process.env,
) {
  return {
    apiKey: environment.LGU_EGOVPAY_API_KEY?.trim() || environment.EGOVPAY_API_KEY?.trim(),
    baseUrl: environment.LGU_EGOVPAY_BASE_URL?.trim() || environment.EGOVPAY_BASE_URL?.trim(),
    settlementTemplateUuid:
      environment.LGU_EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim() ||
      environment.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim(),
  };
}

function createLazyPaymentProvider(
  environment: NodeJS.ProcessEnv = process.env,
): LguPaymentProvider {
  let provider: LguPaymentProvider | undefined;

  function getProvider() {
    if (provider) return provider;
    const config = lguPaymentEnvironment(environment);
    if (!config.baseUrl || !config.apiKey || !config.settlementTemplateUuid)
      throw new Error("LGU eGovPay configuration is required for permit payment operations.");
    provider = createEgovPayLguPaymentProvider(
      createEgovPayClient({
        apiKey: config.apiKey,
        client: createClient({ baseUrl: config.baseUrl }),
        settlementTemplateUuid: config.settlementTemplateUuid,
      }),
    );
    return provider;
  }

  return {
    createPayment: (input) => getProvider().createPayment(input),
    getTransaction: (transactionUuid) => getProvider().getTransaction(transactionUuid),
    voidTransaction: (transactionUuid) => getProvider().voidTransaction(transactionUuid),
  };
}

function createLgu(): LguService {
  return createLguService({
    repository: createDrizzleLguRepository(getDxDatabase()),
    paymentProvider: createLazyPaymentProvider(),
  });
}

/** Server-only composition root for the app's direct DX LGU usage. */
export function getLgu(): LguService {
  globalCache.__egovBizLgu ??= createLgu();
  return globalCache.__egovBizLgu;
}
