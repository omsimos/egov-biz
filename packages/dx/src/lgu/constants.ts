import type { LguPaymentQuote } from "./types.js";

export const LGU_BUSINESS_PERMIT_FEE = 2_500;

export function getLguPaymentQuote(): LguPaymentQuote {
  return {
    businessPermitFee: LGU_BUSINESS_PERMIT_FEE,
    totalFee: LGU_BUSINESS_PERMIT_FEE,
    currency: "PHP",
  };
}
