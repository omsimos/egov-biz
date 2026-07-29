export class PaymentUrlConfigurationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "PaymentUrlConfigurationError";
  }
}

function clean(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    return trimmed.slice(1, -1).trim();
  return trimmed;
}

function withProtocol(value: string) {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value)
    ? `http://${value}`
    : `https://${value}`;
}

export function normalizePaymentUrl(
  value: string,
  field: string,
  options: { allowLocalHttp?: boolean } = {},
) {
  const cleaned = clean(value);
  if (!cleaned) throw new PaymentUrlConfigurationError(field, `${field} is empty`);
  let url: URL;
  try {
    url = new URL(withProtocol(cleaned));
  } catch {
    throw new PaymentUrlConfigurationError(field, `${field} is not a valid URL`);
  }
  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(options.allowLocalHttp && local))
    throw new PaymentUrlConfigurationError(field, `${field} must use HTTPS`);
  url.hash = "";
  return url;
}

function optionalConfiguredUrl(value: string | undefined, field: string) {
  return value?.trim() ? normalizePaymentUrl(value, field, { allowLocalHttp: true }) : null;
}

export function egovPayBaseUrl() {
  const value = process.env.EGOVPAY_BASE_URL;
  if (!value?.trim())
    throw new PaymentUrlConfigurationError("EGOVPAY_BASE_URL", "EGOVPAY_BASE_URL is missing");
  const url = normalizePaymentUrl(value, "EGOVPAY_BASE_URL", { allowLocalHttp: true });
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function paymentUrls(
  request: Request,
  context?: {
    conversationId: string;
    paymentService?: "dti-business-name" | "lgu-business-permit";
    transactionId?: string;
  },
) {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    throw new PaymentUrlConfigurationError("request URL", "The application request URL is invalid");
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const inferred = forwardedHost
    ? `${forwardedProtocol ?? "https"}://${forwardedHost}`
    : requestUrl.origin;
  const app =
    optionalConfiguredUrl(process.env.APP_URL, "APP_URL") ??
    normalizePaymentUrl(inferred, "application URL", { allowLocalHttp: true });
  const callback =
    optionalConfiguredUrl(process.env.EGOVPAY_CALLBACK_URL, "EGOVPAY_CALLBACK_URL") ??
    new URL("/api/payments/egovpay/callback", app);
  const returnUrl =
    optionalConfiguredUrl(process.env.EGOVPAY_RETURN_URL, "EGOVPAY_RETURN_URL") ??
    new URL("/", app);
  if (context) {
    returnUrl.searchParams.set("chat", context.conversationId);
    returnUrl.searchParams.set("payment", "return");
    if (context.paymentService)
      returnUrl.searchParams.set("paymentService", context.paymentService);
    if (context.transactionId) returnUrl.searchParams.set("transactionId", context.transactionId);
  } else if (!returnUrl.searchParams.has("payment")) {
    returnUrl.searchParams.set("payment", "return");
  }

  return { callbackUrl: callback.toString(), redirectUrl: returnUrl.toString() };
}

export function hostedCheckoutUrl(value: string, baseUrl: string) {
  if (!value?.trim()) throw new Error("eGovPay returned an empty checkout URL");
  const url = new URL(clean(value), `${baseUrl.replace(/\/+$/, "")}/`);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
    throw new Error("eGovPay returned an insecure checkout URL");
  return url;
}
