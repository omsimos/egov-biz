import { createEgovPayClient } from "@omsimos/dx";
import {
  createBnrsService,
  createDrizzleBnrsRepository,
  createEgovPayBnrsPaymentProvider,
  type BnrsPaymentProvider,
  type BnrsService,
} from "@omsimos/dx/bnrs";
import { createClient, type EgovSsoCitizenProfile } from "egov.js";
import { getDxDatabase } from "@/server/dx/database";

const globalCache = globalThis as typeof globalThis & {
  __egovBizBnrs?: BnrsService;
};

/**
 * Defer all eGovPay configuration reads until a payment operation is actually
 * called. Phase 1 catalog reads therefore work without payment credentials,
 * while the same composed BNRS instance is ready for the Phase 2 cutover.
 */
function createLazyPaymentProvider(
  environment: NodeJS.ProcessEnv = process.env,
): BnrsPaymentProvider {
  let provider: BnrsPaymentProvider | undefined;

  function getProvider() {
    if (provider) return provider;
    const baseUrl = environment.EGOVPAY_BASE_URL?.trim();
    const apiKey = environment.EGOVPAY_API_KEY?.trim();
    const settlementTemplateUuid = environment.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim();
    if (!baseUrl || !apiKey || !settlementTemplateUuid)
      throw new Error("eGovPay configuration is required for BNRS payment operations.");
    provider = createEgovPayBnrsPaymentProvider(
      createEgovPayClient({
        apiKey,
        client: createClient({ baseUrl }),
        settlementTemplateUuid,
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

function createBnrs(): BnrsService {
  return createBnrsService({
    repository: createDrizzleBnrsRepository(getDxDatabase()),
    paymentProvider: createLazyPaymentProvider(),
  });
}

/** Server-only composition root for the app's direct DX BNRS usage. */
export function getBnrs(): BnrsService {
  globalCache.__egovBizBnrs ??= createBnrs();
  return globalCache.__egovBizBnrs;
}

export function bnrsActorFromProfile(profile: EgovSsoCitizenProfile) {
  const egovUserId = typeof profile.uniqid === "string" ? profile.uniqid.trim() : "";
  if (!egovUserId) throw new Error("The authenticated eGov profile has no user identifier.");
  return { egovUserId };
}
