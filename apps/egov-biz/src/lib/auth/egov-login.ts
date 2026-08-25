import {
  payloadNumber,
  payloadRecord,
  payloadText,
  type PayloadRecord,
  type PayloadValue,
} from "@/lib/payload";

export type EgovSsoFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type EgovSsoRequestOptions = {
  apiUrl: string;
  fetcher?: EgovSsoFetch;
  partnerCode: string;
};

type EgovSsoEmailRequest = EgovSsoRequestOptions & {
  email: string;
};

type EgovSsoOtpRequest = EgovSsoEmailRequest & {
  otp: string;
};

type EgovSsoMpinRequest = EgovSsoEmailRequest & {
  mpin: string;
  otpValidationToken: string;
};

export class EgovSsoRequestError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "EgovSsoRequestError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function requestUrl(apiUrl: string, path: string) {
  const baseUrl = new URL(apiUrl);
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}${path}`;
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl;
}

function stringValue(value: PayloadValue) {
  return payloadText(value).trim() || undefined;
}

function retryAfterSeconds(body: PayloadRecord) {
  const seconds = payloadNumber(payloadRecord(body.meta).seconds);
  return seconds !== null && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}

async function readJson(response: Response): Promise<PayloadRecord> {
  try {
    return payloadRecord(await response.json());
  } catch {
    return {};
  }
}

async function postEgovSso(
  apiUrl: string,
  path: string,
  body: PayloadRecord,
  fallbackError: string,
  fetcher: EgovSsoFetch = fetch,
) {
  let response: Response;
  try {
    response = await fetcher(requestUrl(apiUrl, path), {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    throw new EgovSsoRequestError("Could not reach eGovPH. Check your connection and try again.");
  }

  const result = await readJson(response);
  if (!response.ok) {
    throw new EgovSsoRequestError(
      stringValue(result.message) ?? fallbackError,
      retryAfterSeconds(result),
    );
  }
  return result;
}

export async function checkEgovSsoPartner({ apiUrl, fetcher, partnerCode }: EgovSsoRequestOptions) {
  const result = await postEgovSso(
    apiUrl,
    "/api/partner/check_access",
    { partner_code: partnerCode },
    "This eGovPH partner login is not available.",
    fetcher,
  );
  // Staging currently serializes this flag as 1; production/widget builds
  // have also used a JSON boolean. Accept only those two affirmative values.
  if (result.is_code_valid !== true && result.is_code_valid !== 1) {
    throw new EgovSsoRequestError("This eGovPH partner login is not available.");
  }
}

export async function requestEgovSsoOtp({
  apiUrl,
  email,
  fetcher,
  partnerCode,
}: EgovSsoEmailRequest) {
  await postEgovSso(
    apiUrl,
    "/api/otp_generate",
    {
      partner_code: partnerCode,
      type: "EMAIL",
      username: email,
    },
    "eGovPH could not send an OTP to this email.",
    fetcher,
  );
}

export async function validateEgovSsoOtp({
  apiUrl,
  email,
  fetcher,
  otp,
  partnerCode,
}: EgovSsoOtpRequest) {
  const result = await postEgovSso(
    apiUrl,
    "/api/otp_validate",
    {
      otp,
      partner_code: partnerCode,
      type: "EMAIL",
      username: email,
    },
    "That OTP could not be verified.",
    fetcher,
  );
  const token = stringValue(result.otp_validation_token);
  if (!token) {
    throw new EgovSsoRequestError("eGovPH did not return a valid OTP confirmation.");
  }
  return token;
}

export async function authenticateEgovSsoMpin({
  apiUrl,
  email,
  fetcher,
  mpin,
  otpValidationToken,
  partnerCode,
}: EgovSsoMpinRequest) {
  const result = await postEgovSso(
    apiUrl,
    "/api/authenticate",
    {
      otp_validation_token: otpValidationToken,
      partner_code: partnerCode,
      pin: mpin,
      username: email,
    },
    "That MPIN could not be authenticated.",
    fetcher,
  );
  const exchangeCode = stringValue(result.exchange_code);
  if (!exchangeCode) {
    throw new EgovSsoRequestError("eGovPH did not return a valid sign-in confirmation.");
  }
  return exchangeCode;
}
