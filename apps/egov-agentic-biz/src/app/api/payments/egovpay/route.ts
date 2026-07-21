import { eGovPayApi } from "@repo/egov/eGovPay";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { dtiRegistrationFee } from "@/lib/dti-fees";
import {
  egovPayBaseUrl,
  hostedCheckoutUrl,
  PaymentUrlConfigurationError,
  paymentUrls,
} from "@/lib/payment-urls";
import { classifyPaymentNetworkError, paymentNetworkMessage } from "@/lib/payment-network";
import { getConversation } from "@/server/conversations";
import {
  createPayment,
  getLatestPaymentForService,
  isPaidStatus,
  type PaymentServiceType,
} from "@/server/payments";

export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("serviceType", [
  z.object({
    serviceType: z.literal("dti-business-name"),
    conversationId: z.string().uuid(),
    proposedName: z.string().trim().min(1).max(200),
    territorialScope: z.enum(["Barangay", "City / municipality", "Regional", "National"]),
    serviceReference: z.string().max(200).optional(),
  }),
  z.object({
    serviceType: z.literal("barangay-clearance"),
    conversationId: z.string().uuid(),
    proposedName: z.string().trim().min(1).max(200),
    serviceReference: z.string().trim().min(1).max(200),
  }),
  z.object({
    serviceType: z.literal("ebpls-business-permit"),
    conversationId: z.string().uuid(),
    proposedName: z.string().trim().min(1).max(200),
    serviceReference: z.string().trim().min(1).max(200),
  }),
]);

const services: Record<PaymentServiceType, { amount: number; prefix: string; label: string }> = {
  "dti-business-name": {
    amount: 0,
    prefix: "DTI-BNR",
    label: "DTI Business Name Registration",
  },
  "barangay-clearance": {
    amount: 500,
    prefix: "BRGY-CLR",
    label: "Barangay Business Clearance",
  },
  "ebpls-business-permit": {
    amount: 2_500,
    prefix: "EBPLS-BP",
    label: "EBPLS Mayor’s / Business Permit",
  },
};

export async function POST(request: Request) {
  const session = readSession(request);
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Check the application details and try again." },
      { status: 400 },
    );
  if (!getConversation(parsed.data.conversationId))
    return Response.json({ error: "Chat session not found." }, { status: 404 });

  if (
    !process.env.EGOVPAY_BASE_URL?.trim() ||
    !process.env.EGOVPAY_API_KEY?.trim() ||
    !process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim()
  )
    return Response.json({ error: "eGovPay is not available right now." }, { status: 503 });

  const existing = getLatestPaymentForService(parsed.data.conversationId, parsed.data.serviceType);
  if (existing && isPaidStatus(existing.status))
    return Response.json(
      { error: "This fee has already been paid.", payment: existing },
      { status: 409 },
    );

  const service = services[parsed.data.serviceType];
  const amount =
    parsed.data.serviceType === "dti-business-name"
      ? dtiRegistrationFee(parsed.data.territorialScope)
      : service.amount;
  const transactionId = `${service.prefix}-${crypto.randomUUID()}`;

  try {
    const baseUrl = egovPayBaseUrl();
    const { callbackUrl, redirectUrl } = paymentUrls(request, {
      conversationId: parsed.data.conversationId,
      transactionId,
    });
    const payment = await eGovPayApi.fromEnv({ baseUrl }).generatePayment(
      {
        amount,
        callbackUrl,
        currency: "PHP",
        description: {
          service: service.label,
          ...(parsed.data.serviceType === "dti-business-name"
            ? { scope: parsed.data.territorialScope }
            : { reference: parsed.data.serviceReference }),
        },
        items: [{ amount, name: service.label }],
        name: session.profile.fullName,
        redirectUrl,
        transactionId,
        ...(session.profile.mobile ? { mobile: session.profile.mobile } : {}),
      },
      { signal: AbortSignal.timeout(12_000) },
    );
    const checkoutUrl = hostedCheckoutUrl(payment.data.url, baseUrl);
    const storedPayment = createPayment({
      conversationId: parsed.data.conversationId,
      transactionUuid: payment.data.uuid,
      transactionId,
      amount,
      status: "pending",
      proposedName: parsed.data.proposedName,
      territorialScope:
        parsed.data.serviceType === "dti-business-name"
          ? parsed.data.territorialScope
          : "Not applicable",
      ownerName: session.profile.fullName,
      serviceType: parsed.data.serviceType,
      serviceReference: parsed.data.serviceReference ?? null,
    });
    return Response.json({
      checkoutUrl: checkoutUrl.toString(),
      transactionUuid: payment.data.uuid,
      transactionId,
      amount,
      payment: storedPayment,
    });
  } catch (error) {
    if (error instanceof PaymentUrlConfigurationError) {
      console.error("eGovPay URL configuration failed", {
        field: error.field,
        reason: error.message,
      });
      return Response.json(
        { error: "Online payment is not configured correctly right now." },
        { status: 503 },
      );
    }
    const networkCode = classifyPaymentNetworkError(error);
    if (networkCode) {
      console.error("eGovPay network request failed", { code: networkCode });
      return Response.json(
        { error: paymentNetworkMessage(networkCode), code: networkCode },
        { status: 503 },
      );
    }
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
