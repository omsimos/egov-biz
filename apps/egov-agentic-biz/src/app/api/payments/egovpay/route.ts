import { eGovPayApi } from "@repo/egov/eGovPay";
import { z } from "zod";
import { dtiRegistrationFee } from "@/lib/dti-fees";
import { egovPayBaseUrl, hostedCheckoutUrl, PaymentUrlConfigurationError, paymentUrls } from "@/lib/payment-urls";
import { classifyPaymentNetworkError, paymentNetworkMessage } from "@/lib/payment-network";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  proposedName: z.string().trim().min(1).max(200),
  territorialScope: z.enum(["Barangay", "City / municipality", "Regional", "National"]),
  ownerName: z.string().trim().min(1).max(200),
  mobile: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Check the application details and try again." }, { status: 400 });

  if (!process.env.EGOVPAY_BASE_URL?.trim() || !process.env.EGOVPAY_API_KEY?.trim() || !process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim()) {
    return Response.json({ error: "eGovPay is not available right now." }, { status: 503 });
  }

  const amount = dtiRegistrationFee(parsed.data.territorialScope);
  const transactionId = `DTI-BNR-${crypto.randomUUID()}`;
  try {
    const baseUrl = egovPayBaseUrl();
    const { callbackUrl, redirectUrl } = paymentUrls(request);
    const payment = await eGovPayApi.fromEnv({ baseUrl }).generatePayment({
      amount,
      callbackUrl,
      currency: "PHP",
      description: { service: "DTI Business Name Registration", scope: parsed.data.territorialScope },
      items: [{ amount, name: `DTI business name registration — ${parsed.data.territorialScope}` }],
      mobile: parsed.data.mobile,
      name: parsed.data.ownerName,
      redirectUrl,
      transactionId,
    }, { signal: AbortSignal.timeout(12_000) });
    const checkoutUrl = hostedCheckoutUrl(payment.data.url, baseUrl);
    return Response.json({ checkoutUrl: checkoutUrl.toString(), transactionUuid: payment.data.uuid, transactionId, amount });
  } catch (error) {
    if (error instanceof PaymentUrlConfigurationError) {
      console.error("eGovPay URL configuration failed", { field: error.field, reason: error.message });
      return Response.json({ error: "Online payment is not configured correctly right now." }, { status: 503 });
    }
    const networkCode = classifyPaymentNetworkError(error);
    if (networkCode) {
      console.error("eGovPay network request failed", { code: networkCode });
      return Response.json({ error: paymentNetworkMessage(networkCode), code: networkCode }, { status: 503 });
    }
    console.error("eGovPay payment creation failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "eGovPay could not open checkout. Please try again." }, { status: 502 });
  }
}
