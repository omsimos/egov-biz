import { BnrsError } from "@repo/dx/bnrs";
import { LguError } from "@repo/dx/lgu";
import {
  findConversationByBnrsPayment,
  findConversationByLguPayment,
  linkBnrsCertificateByApplication,
  markPaymentCheckpointComplete,
} from "@/server/conversations";
import { getBnrs } from "@/server/dx/bnrs";
import { getLgu } from "@/server/dx/lgu";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const transactionUuid = [body.uuid, body.transaction_uuid, body.transactionUuid].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (!transactionUuid)
      return Response.json({ error: "Missing transaction reference" }, { status: 400 });

    const [bnrsLink, lguLink] = await Promise.all([
      findConversationByBnrsPayment(transactionUuid),
      findConversationByLguPayment(transactionUuid),
    ]);
    if (bnrsLink) {
      const result = await getBnrs().syncPaymentStatus({ transactionUuid });
      if (result.registration) {
        await linkBnrsCertificateByApplication(
          result.status.applicationId,
          result.registration.certificateNumber,
        );
        await markPaymentCheckpointComplete(bnrsLink.ownerEgovUserId, bnrsLink.conversationId);
      }
      return Response.json({
        received: true,
        paymentStatus: result.status.payment?.status ?? null,
        serviceType: "dti-business-name",
      });
    }
    if (lguLink) {
      const result = await getLgu().syncPaymentStatus({ transactionUuid });
      return Response.json({
        received: true,
        paymentStatus: result.status.payment?.status ?? null,
        serviceType: "lgu-business-permit",
      });
    }
    return Response.json({ error: "Unknown transaction reference" }, { status: 404 });
  } catch (error) {
    if (
      (error instanceof BnrsError && error.code === "PAYMENT_NOT_FOUND") ||
      (error instanceof LguError && error.code === "PAYMENT_NOT_FOUND")
    )
      return Response.json({ error: "Unknown transaction reference" }, { status: 404 });
    console.error(
      "eGovPay callback verification failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response(null, { status: 502 });
  }
}
