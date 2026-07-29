import { createDatabaseFromEnv, type Database } from "@repo/db";
import {
  createBnrsService,
  createDrizzleBnrsRepository,
  createEgovPayBnrsPaymentProvider,
  type BnrsPaymentProvider,
  type BnrsService,
} from "@repo/dx/bnrs";
import { eGovPayApi } from "@repo/egov/eGovPay";
import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";

type BnrsComposition = {
  bnrs: BnrsService;
  database: Database;
};

const globalCache = globalThis as typeof globalThis & {
  __egovBizBnrsComposition?: BnrsComposition;
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
    if (!baseUrl) throw new Error("EGOVPAY_BASE_URL is required for BNRS payment operations.");
    provider = createEgovPayBnrsPaymentProvider(eGovPayApi.fromEnv({ baseUrl, env: environment }));
    return provider;
  }

  return {
    createPayment: (input) => getProvider().createPayment(input),
    getTransaction: (transactionUuid) => getProvider().getTransaction(transactionUuid),
    voidTransaction: (transactionUuid) => getProvider().voidTransaction(transactionUuid),
  };
}

function createBnrsComposition(): BnrsComposition {
  const database = createDatabaseFromEnv();
  const repository = createDrizzleBnrsRepository(database);
  const bnrs = createBnrsService({
    repository,
    paymentProvider: createLazyPaymentProvider(),
  });
  return { bnrs, database };
}

/** Server-only composition root for the app's direct DX BNRS usage. */
export function getBnrs(): BnrsService {
  globalCache.__egovBizBnrsComposition ??= createBnrsComposition();
  return globalCache.__egovBizBnrsComposition.bnrs;
}

export function bnrsActorFromProfile(profile: EgovSsoCitizenProfile) {
  const egovUserId = typeof profile.uniqid === "string" ? profile.uniqid.trim() : "";
  if (!egovUserId) throw new Error("The authenticated eGov profile has no user identifier.");
  return { egovUserId };
}
