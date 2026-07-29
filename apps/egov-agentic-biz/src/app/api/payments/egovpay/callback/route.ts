import { BnrsError } from "@repo/dx/bnrs";
import { eGovPayApi } from "@repo/egov/eGovPay";
import { egovPayBaseUrl, PaymentUrlConfigurationError } from "@/lib/payment-urls";
import {
  linkBnrsCertificateByApplication,
  markPaymentCheckpointComplete,
} from "@/server/conversations";
import { getBnrs } from "@/server/dx/bnrs";
import { getPaymentByUuid, updatePaymentStatus } from "@/server/payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (
    !process.env.EGOVPAY_BASE_URL?.trim() ||
    !process.env.EGOVPAY_API_KEY?.trim() ||
    !process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim()
  )
    return new Response(null, { status: 503 });
  try {
    const baseUrl = egovPayBaseUrl();
    const body = (await request.json()) as Record<string, unknown>;
    const transactionUuid = [body.uuid, body.transaction_uuid, body.transactionUuid].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (!transactionUuid)
      return Response.json({ error: "Missing transaction reference" }, { status: 400 });
    const legacyPayment = await getPaymentByUuid(transactionUuid);
    if (legacyPayment && legacyPayment.serviceType !== "dti-business-name") {
      const transaction = await eGovPayApi
        .fromEnv({ baseUrl })
        .getTransaction(transactionUuid, { signal: AbortSignal.timeout(12_000) });
      // Fulfillment relies on this server-to-server status, never callback payload claims.
      await updatePaymentStatus(
        transactionUuid,
        transaction.data.payment_status,
        transaction.data.paid_at,
      );
      return Response.json({ received: true, paymentStatus: transaction.data.payment_status });
    }

    const result = await getBnrs().syncPaymentStatus({ transactionUuid });
    const linked = result.registration
      ? await linkBnrsCertificateByApplication(
          result.status.applicationId,
          result.registration.certificateNumber,
        )
      : null;
    if (linked) await markPaymentCheckpointComplete(linked.ownerEgovUserId, linked.conversationId);
    return Response.json({
      received: true,
      paymentStatus: result.status.payment?.status ?? null,
    });
  } catch (error) {
    if (error instanceof BnrsError && error.code === "PAYMENT_NOT_FOUND")
      return Response.json({ error: "Unknown transaction reference" }, { status: 404 });
    if (error instanceof PaymentUrlConfigurationError) {
      console.error("eGovPay callback URL configuration failed", {
        field: error.field,
        reason: error.message,
      });
      return new Response(null, { status: 503 });
    }
    console.error(
      "eGovPay callback verification failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response(null, { status: 502 });
  }
}
