import { BnrsError } from "@omsimos/dx/bnrs";
import { LguError } from "@omsimos/dx/lgu";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import {
  egovPayBaseUrl,
  hostedCheckoutUrl,
  PaymentUrlConfigurationError,
  paymentUrls,
} from "@/lib/payment-urls";
import { classifyPaymentNetworkError, paymentNetworkMessage } from "@/lib/payment-network";
import { BirDstPaymentError, createBirDstCheckout } from "@/server/bir-dst-payment";
import { getConversation } from "@/server/conversations";
import { listBirArtifacts } from "@/server/dx/bir-artifacts";
import { bnrsActorFromProfile } from "@/server/dx/bnrs";
import { createBnrsCheckout } from "@/server/dx/bnrs-applications";
import { lguPaymentEnvironment } from "@/server/dx/lgu";
import { createLguCheckout } from "@/server/dx/lgu-applications";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  serviceType: z.enum(["dti-business-name", "lgu-business-permit", "bir-documentary-stamp-tax"]),
  conversationId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const actor = bnrsActorFromProfile(session.rawProfile);
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Check the application details and try again." },
      { status: 400 },
    );
  if (!(await getConversation(actor.egovUserId, parsed.data.conversationId)))
    return Response.json({ error: "Chat session not found." }, { status: 404 });

  try {
    const urls = paymentUrls(request, {
      conversationId: parsed.data.conversationId,
      paymentService: parsed.data.serviceType,
    });
    if (parsed.data.serviceType === "bir-documentary-stamp-tax") {
      const artifact = (
        await listBirArtifacts({
          conversationId: parsed.data.conversationId,
          ownerEgovUserId: actor.egovUserId,
        })
      ).find(({ formType }) => formType === "1901");
      if (!artifact)
        return Response.json(
          { error: "Generate BIR Form 1901 before paying the documentary stamp tax." },
          { status: 409 },
        );
      const baseUrl = egovPayBaseUrl();
      const checkout = await createBirDstCheckout({
        artifactId: artifact.artifactId,
        callbackUrl: urls.callbackUrl,
        conversationId: parsed.data.conversationId,
        email: session.profile.email || undefined,
        mobile: session.profile.mobile || undefined,
        redirectUrl: urls.redirectUrl,
        taxpayerName: session.profile.fullName,
      });
      return Response.json({
        amount: checkout.amount,
        checkoutUrl: hostedCheckoutUrl(checkout.checkoutUrl, baseUrl).toString(),
        payment: {
          serviceType: parsed.data.serviceType,
          status: checkout.payment.status,
        },
        transactionId: checkout.transactionId,
        transactionUuid: checkout.transactionUuid,
      });
    }
    if (parsed.data.serviceType === "dti-business-name") {
      const baseUrl = egovPayBaseUrl();
      const checkout = await createBnrsCheckout({
        actor,
        callbackUrl: urls.callbackUrl,
        conversationId: parsed.data.conversationId,
        redirectUrl: urls.redirectUrl,
      });
      return Response.json({
        amount: checkout.amount,
        checkoutUrl: hostedCheckoutUrl(checkout.checkoutUrl, baseUrl).toString(),
        payment: { serviceType: parsed.data.serviceType, status: "pending" },
        transactionId: checkout.transactionId,
        transactionUuid: checkout.transactionUuid,
      });
    }

    const lguEnvironment = lguPaymentEnvironment();
    if (!lguEnvironment.baseUrl)
      throw new PaymentUrlConfigurationError(
        "LGU_EGOVPAY_BASE_URL",
        "LGU eGovPay base URL is missing",
      );
    const checkout = await createLguCheckout({
      actor,
      callbackUrl: urls.callbackUrl,
      conversationId: parsed.data.conversationId,
      redirectUrl: urls.redirectUrl,
    });
    return Response.json({
      amount: checkout.amount,
      checkoutUrl: hostedCheckoutUrl(checkout.checkoutUrl, lguEnvironment.baseUrl).toString(),
      payment: { serviceType: parsed.data.serviceType, status: "pending" },
      transactionId: checkout.transactionId,
      transactionUuid: checkout.transactionUuid,
    });
  } catch (error) {
    if (
      error instanceof BnrsError ||
      error instanceof LguError ||
      error instanceof BirDstPaymentError
    )
      return Response.json({ error: error.message, code: error.code }, { status: 409 });
    if (error instanceof PaymentUrlConfigurationError)
      return Response.json(
        { error: "Online payment is not configured correctly right now." },
        { status: 503 },
      );
    const networkCode = classifyPaymentNetworkError(error);
    if (networkCode)
      return Response.json(
        { error: paymentNetworkMessage(networkCode), code: networkCode },
        { status: 503 },
      );
    console.error(
      "eGovPay payment creation failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "eGovPay could not open checkout. Please try again." },
      { status: 502 },
    );
  }
}
