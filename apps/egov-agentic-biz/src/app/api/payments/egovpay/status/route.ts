import { eGovPayApi } from "@repo/egov/eGovPay";
import { z } from "zod";
import { egovPayBaseUrl } from "@/lib/payment-urls";
import { getPaymentByTransactionId, isPaidStatus, updatePaymentStatus } from "@/server/payments";

export const dynamic = "force-dynamic";

const querySchema = z.object({ transactionId: z.string().trim().min(1).max(150) });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({
    transactionId: new URL(request.url).searchParams.get("transactionId"),
  });
  if (!parsed.success)
    return Response.json({ error: "Missing payment reference" }, { status: 400 });
  const payment = getPaymentByTransactionId(parsed.data.transactionId);
  if (!payment) return Response.json({ error: "Payment not found" }, { status: 404 });
  if (isPaidStatus(payment.status)) return Response.json({ payment });

  if (
    process.env.EGOVPAY_BASE_URL?.trim() &&
    process.env.EGOVPAY_API_KEY?.trim() &&
    process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim()
  ) {
    try {
      const transaction = await eGovPayApi
        .fromEnv({ baseUrl: egovPayBaseUrl() })
        .getTransaction(payment.transactionUuid, { signal: AbortSignal.timeout(12_000) });
      const current = updatePaymentStatus(
        payment.transactionUuid,
        transaction.data.payment_status,
        transaction.data.paid_at,
      );
      return Response.json({ payment: current });
    } catch (error) {
      console.warn(
        "Payment return verification is temporarily unavailable",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
  return Response.json({ payment });
}
