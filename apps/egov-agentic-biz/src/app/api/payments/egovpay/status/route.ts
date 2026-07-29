import { BnrsError } from "@repo/dx/bnrs";
import { eGovPayApi } from "@repo/egov/eGovPay";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { egovPayBaseUrl } from "@/lib/payment-urls";
import { getConversation, markPaymentCheckpointComplete } from "@/server/conversations";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";
import { syncBnrsPaymentForConversation } from "@/server/dx/bnrs-applications";
import { getPaymentByTransactionId, isPaidStatus, updatePaymentStatus } from "@/server/payments";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    conversationId: z.string().uuid().nullable(),
    transactionId: z.string().trim().min(1).max(150).nullable(),
  })
  .refine((query) => Boolean(query.conversationId || query.transactionId));

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const actor = bnrsActorFromProfile(session.rawProfile);
  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    conversationId: searchParams.get("conversationId"),
    transactionId: searchParams.get("transactionId"),
  });
  if (!parsed.success)
    return Response.json({ error: "Missing payment reference" }, { status: 400 });
  if (parsed.data.conversationId) {
    if (!(await getConversation(actor.egovUserId, parsed.data.conversationId)))
      return Response.json({ error: "Payment not found" }, { status: 404 });
    try {
      const result = await syncBnrsPaymentForConversation({
        actor,
        conversationId: parsed.data.conversationId,
      });
      if (result.registration)
        await markPaymentCheckpointComplete(actor.egovUserId, parsed.data.conversationId);
      return Response.json({
        payment: {
          serviceType: "dti-business-name",
          status: result.status.payment?.status.toLowerCase() ?? "pending",
        },
        registration: result.registration,
      });
    } catch (error) {
      if (error instanceof BnrsError)
        return Response.json({ error: error.message, code: error.code }, { status: 409 });
      throw error;
    }
  }

  const payment = await getPaymentByTransactionId(parsed.data.transactionId!);
  if (!payment) return Response.json({ error: "Payment not found" }, { status: 404 });
  if (payment.serviceType === "dti-business-name")
    return Response.json({ error: "Payment not found" }, { status: 404 });
  if (!(await getConversation(actor.egovUserId, payment.conversationId)))
    return Response.json({ error: "Payment not found" }, { status: 404 });
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
      const current = await updatePaymentStatus(
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
