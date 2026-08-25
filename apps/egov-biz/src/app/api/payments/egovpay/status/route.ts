import { BnrsError } from "@repo/dx/bnrs";
import { LguError } from "@repo/dx/lgu";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { getConversation, markPaymentCheckpointComplete } from "@/server/conversations";
import { BirDstPaymentError, syncBirDstPaymentForConversation } from "@/server/bir-dst-payment";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";
import { syncBnrsPaymentForConversation } from "@/server/dx/bnrs-applications";
import { syncLguPaymentForConversation } from "@/server/dx/lgu-applications";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  conversationId: z.string().uuid(),
  serviceType: z
    .enum(["dti-business-name", "lgu-business-permit", "bir-documentary-stamp-tax"])
    .default("dti-business-name"),
});

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const actor = bnrsActorFromProfile(session.rawProfile);
  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    conversationId: searchParams.get("conversationId"),
    serviceType: searchParams.get("serviceType") ?? undefined,
  });
  if (!parsed.success)
    return Response.json({ error: "Missing payment reference" }, { status: 400 });
  if (!(await getConversation(actor.egovUserId, parsed.data.conversationId)))
    return Response.json({ error: "Payment not found" }, { status: 404 });

  try {
    if (parsed.data.serviceType === "bir-documentary-stamp-tax") {
      const payment = await syncBirDstPaymentForConversation(parsed.data.conversationId);
      return Response.json({
        payment: {
          serviceType: parsed.data.serviceType,
          status: payment.status.toLowerCase(),
        },
      });
    }
    if (parsed.data.serviceType === "lgu-business-permit") {
      const result = await syncLguPaymentForConversation({
        actor,
        conversationId: parsed.data.conversationId,
      });
      return Response.json({
        payment: {
          serviceType: parsed.data.serviceType,
          status: result.status.payment?.status.toLowerCase() ?? "pending",
        },
      });
    }

    const result = await syncBnrsPaymentForConversation({
      actor,
      conversationId: parsed.data.conversationId,
    });
    if (result.registration)
      await markPaymentCheckpointComplete(actor.egovUserId, parsed.data.conversationId);
    return Response.json({
      payment: {
        serviceType: parsed.data.serviceType,
        status: result.status.payment?.status.toLowerCase() ?? "pending",
      },
      registration: result.registration,
    });
  } catch (error) {
    if (
      error instanceof BnrsError ||
      error instanceof LguError ||
      error instanceof BirDstPaymentError
    )
      return Response.json({ error: error.message, code: error.code }, { status: 409 });
    throw error;
  }
}
