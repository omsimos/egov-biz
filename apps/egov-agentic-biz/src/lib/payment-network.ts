export type PaymentNetworkErrorCode =
  | "DNS_NOT_FOUND"
  | "DNS_TEMPORARY_FAILURE"
  | "CONNECTION_REFUSED"
  | "CONNECTION_TIMEOUT"
  | "NETWORK_UNREACHABLE"
  | "TLS_ERROR"
  | "FETCH_FAILED";

function errorChain(error: unknown) {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current && !seen.has(current) && chain.length < 6) {
    chain.push(current); seen.add(current);
    current = typeof current === "object" && current !== null && "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return chain;
}

function value(error: unknown, key: "code" | "name" | "message") {
  if (typeof error !== "object" || error === null || !(key in error)) return "";
  return String((error as Record<string, unknown>)[key] ?? "");
}

export function classifyPaymentNetworkError(error: unknown): PaymentNetworkErrorCode | null {
  const values = errorChain(error).flatMap((item) => [value(item, "code"), value(item, "name"), value(item, "message")]).join(" ").toUpperCase();
  if (/ENOTFOUND|DNS_NOT_FOUND|GETADDRINFO.*NOTFOUND/.test(values)) return "DNS_NOT_FOUND";
  if (/EAI_AGAIN|DNS_TEMPORARY/.test(values)) return "DNS_TEMPORARY_FAILURE";
  if (/ECONNREFUSED|CONNECTIONREFUSED|CONNECTION REFUSED/.test(values)) return "CONNECTION_REFUSED";
  if (/ETIMEDOUT|TIMEOUTERROR|CONNECT_TIMEOUT|TIMED OUT/.test(values)) return "CONNECTION_TIMEOUT";
  if (/ENETUNREACH|EHOSTUNREACH|NETWORK.*UNREACHABLE/.test(values)) return "NETWORK_UNREACHABLE";
  if (/CERT_|ERR_TLS|TLS_ERROR|SSL_ERROR|UNABLE_TO_VERIFY|CERTIFICATE/.test(values)) return "TLS_ERROR";
  if (/FETCH FAILED|UNABLE TO CONNECT/.test(values)) return "FETCH_FAILED";
  return null;
}

export function paymentNetworkMessage(code: PaymentNetworkErrorCode) {
  if (code === "DNS_NOT_FOUND" || code === "DNS_TEMPORARY_FAILURE") return "The payment service address could not be reached.";
  if (code === "CONNECTION_TIMEOUT") return "The payment service took too long to respond.";
  return "The payment service could not be reached right now.";
}
