export type PaymentNetworkErrorCode =
  | "DNS_NOT_FOUND"
  | "DNS_TEMPORARY_FAILURE"
  | "CONNECTION_REFUSED"
  | "CONNECTION_TIMEOUT"
  | "NETWORK_UNREACHABLE"
  | "TLS_ERROR"
  | "FETCH_FAILED";

/**
 * A failed fetch reports the operating-system error through a `cause` link
 * rather than through its own message, so classification has to read the whole
 * chain out into text.
 */
function errorChainText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current && !seen.has(current) && seen.size < 6) {
    seen.add(current);
    // A string, a number and an error object are all reachable here.
    if (typeof current !== "object" || current === null) {
      parts.push("", "", "");
      break;
    }
    parts.push(
      "code" in current ? String(current.code ?? "") : "",
      "name" in current ? String(current.name ?? "") : "",
      "message" in current ? String(current.message ?? "") : "",
    );
    current = "cause" in current ? current.cause : null;
  }
  return parts.join(" ").toUpperCase();
}

/** Called from the payment route's `catch`, with whatever the request threw. */
export function classifyPaymentNetworkError(error: unknown): PaymentNetworkErrorCode | null {
  const values = errorChainText(error);
  if (/ENOTFOUND|DNS_NOT_FOUND|GETADDRINFO.*NOTFOUND/.test(values)) return "DNS_NOT_FOUND";
  if (/EAI_AGAIN|DNS_TEMPORARY/.test(values)) return "DNS_TEMPORARY_FAILURE";
  if (/ECONNREFUSED|CONNECTIONREFUSED|CONNECTION REFUSED/.test(values)) return "CONNECTION_REFUSED";
  if (/ETIMEDOUT|TIMEOUTERROR|CONNECT_TIMEOUT|TIMED OUT/.test(values)) return "CONNECTION_TIMEOUT";
  if (/ENETUNREACH|EHOSTUNREACH|NETWORK.*UNREACHABLE/.test(values)) return "NETWORK_UNREACHABLE";
  if (/CERT_|ERR_TLS|TLS_ERROR|SSL_ERROR|UNABLE_TO_VERIFY|CERTIFICATE/.test(values))
    return "TLS_ERROR";
  if (/FETCH FAILED|UNABLE TO CONNECT/.test(values)) return "FETCH_FAILED";
  return null;
}

export function paymentNetworkMessage(code: PaymentNetworkErrorCode) {
  if (code === "DNS_NOT_FOUND" || code === "DNS_TEMPORARY_FAILURE")
    return "The payment service address could not be reached.";
  if (code === "CONNECTION_TIMEOUT") return "The payment service took too long to respond.";
  return "The payment service could not be reached right now.";
}
