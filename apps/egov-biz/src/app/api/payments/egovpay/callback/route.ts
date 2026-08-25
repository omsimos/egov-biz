import { BnrsError } from "@omsimos/dx/bnrs";
import { LguError } from "@omsimos/dx/lgu";
import { BirDstPaymentError, syncBirDstPaymentByUuid } from "@/server/bir-dst-payment";
import {
  findConversationByBnrsPayment,
  findConversationByLguPayment,
  linkBnrsCertificateByApplication,
  markPaymentCheckpointComplete,
} from "@/server/conversations";
import { getBnrs } from "@/server/dx/bnrs";
import { getLgu } from "@/server/dx/lgu";
import { z } from "zod";

export const dynamic = "force-dynamic";

// eGovPay has posted the transaction reference under three different spellings
// across its environments, so all three are read and the first usable one wins.
// Each field catches its own failure so an unexpected value under one key does
// not hide a good reference under another.
const callbackSchema = z
  .object({
    uuid: z.string().min(1).optional().catch(undefined),
    transaction_uuid: z.string().min(1).optional().catch(undefined),
    transactionUuid: z.string().min(1).optional().catch(undefined),
  })
  .catch({});

export async function POST(request: Request) {
  try {
    const body = callbackSchema.parse(await request.json());
    const transactionUuid = body.uuid ?? body.transaction_uuid ?? body.transactionUuid;
    if (!transactionUuid)
      return Response.json({ error: "Missing transaction reference" }, { status: 400 });

    const birPayment = await syncBirDstPaymentByUuid(transactionUuid);
    if (birPayment)
      return Response.json({
        received: true,
        paymentStatus: birPayment.status,
        serviceType: "bir-documentary-stamp-tax",
      });

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
      (error instanceof LguError && error.code === "PAYMENT_NOT_FOUND") ||
      (error instanceof BirDstPaymentError && error.code === "PAYMENT_NOT_FOUND")
    )
      return Response.json({ error: "Unknown transaction reference" }, { status: 404 });
    console.error(
      "eGovPay callback verification failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response(null, { status: 502 });
  }
}
