import { eGovPayApi } from "@repo/egov/eGovPay";
import { z } from "zod";
import { dtiRegistrationFee } from "@/lib/dti-fees";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  proposedName: z.string().trim().min(1).max(200),
  territorialScope: z.enum(["Barangay", "City / municipality", "Regional", "National"]),
  ownerName: z.string().trim().min(1).max(200),
  mobile: z.string().trim().max(40).optional(),
});

function publicOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return new URL(configured).origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProtocol}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Check the application details and try again." }, { status: 400 });

  const baseUrl = process.env.EGOVPAY_BASE_URL?.trim();
  if (!baseUrl || !process.env.EGOVPAY_API_KEY?.trim() || !process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim()) {
    return Response.json({ error: "eGovPay is not available right now." }, { status: 503 });
  }

  const origin = publicOrigin(request);
  if (new URL(origin).hostname === "localhost" || new URL(origin).hostname === "127.0.0.1") {
    return Response.json({ error: "eGovPay needs a public callback URL before checkout can open." }, { status: 503 });
  }

  const amount = dtiRegistrationFee(parsed.data.territorialScope);
  const transactionId = `DTI-BNR-${crypto.randomUUID()}`;
  try {
    const payment = await eGovPayApi.fromEnv({ baseUrl }).generatePayment({
      amount,
      callbackUrl: `${origin}/api/payments/egovpay/callback`,
      currency: "PHP",
      description: { service: "DTI Business Name Registration", scope: parsed.data.territorialScope },
      items: [{ amount, name: `DTI business name registration — ${parsed.data.territorialScope}` }],
      mobile: parsed.data.mobile,
      name: parsed.data.ownerName,
      redirectUrl: `${origin}/?payment=return`,
      transactionId,
    });
    const checkoutUrl = new URL(payment.data.url);
    if (checkoutUrl.protocol !== "https:") throw new Error("Payment URL must use HTTPS");
    return Response.json({ checkoutUrl: checkoutUrl.toString(), transactionUuid: payment.data.uuid, transactionId, amount });
  } catch (error) {
    console.error("eGovPay payment creation failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "eGovPay could not open checkout. Please try again." }, { status: 502 });
  }
}
