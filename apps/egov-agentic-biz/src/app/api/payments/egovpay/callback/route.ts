import { eGovPayApi } from "@repo/egov/eGovPay";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const baseUrl = process.env.EGOVPAY_BASE_URL?.trim();
  if (!baseUrl || !process.env.EGOVPAY_API_KEY?.trim() || !process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID?.trim()) return new Response(null, { status: 503 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const transactionUuid = [body.uuid, body.transaction_uuid, body.transactionUuid].find((value): value is string => typeof value === "string" && value.length > 0);
    if (!transactionUuid) return Response.json({ error: "Missing transaction reference" }, { status: 400 });
    const transaction = await eGovPayApi.fromEnv({ baseUrl }).getTransaction(transactionUuid);
    // Fulfillment must rely on this server-to-server status, never callback payload claims.
    return Response.json({ received: true, paymentStatus: transaction.data.payment_status });
  } catch (error) {
    console.error("eGovPay callback verification failed", error instanceof Error ? error.message : "Unknown error");
    return new Response(null, { status: 502 });
  }
}
