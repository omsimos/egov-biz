import { describe, expect, test } from "bun:test";
import {
  authenticateEgovSsoMpin,
  checkEgovSsoPartner,
  EgovSsoRequestError,
  requestEgovSsoOtp,
  validateEgovSsoOtp,
  type EgovSsoFetch,
} from "@/lib/auth/egov-login";
import type { PayloadRecord } from "@/lib/payload";

const baseRequest = {
  apiUrl: "https://sso.example.test",
  email: "juan@example.test",
  partnerCode: "partner-code",
};

type RecordingFetch = {
  fetcher: EgovSsoFetch;
  requests: Request[];
};

function recordingFetch(responseBody: PayloadRecord, responseStatus = 200): RecordingFetch {
  const requests: Request[] = [];
  return {
    fetcher: async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json(responseBody, { status: responseStatus });
    },
    requests,
  };
}

async function requestBody(request: Request): Promise<PayloadRecord> {
  return await request.json();
}

describe("browser-side eGov SSO login", () => {
  test("checks partner access without exposing a secret", async () => {
    const { fetcher, requests } = recordingFetch({ is_code_valid: 1 });

    await checkEgovSsoPartner({ ...baseRequest, fetcher });

    expect(requests[0]?.url).toBe("https://sso.example.test/api/partner/check_access");
    expect(await requestBody(requests[0]!)).toEqual({ partner_code: "partner-code" });
  });

  test("requests an email OTP using the official SSO request shape", async () => {
    const { fetcher, requests } = recordingFetch({ message: "OTP sent" });

    await requestEgovSsoOtp({ ...baseRequest, fetcher });

    expect(requests[0]?.url).toBe("https://sso.example.test/api/otp_generate");
    expect(await requestBody(requests[0]!)).toEqual({
      partner_code: "partner-code",
      type: "EMAIL",
      username: "juan@example.test",
    });
  });

  test("validates the OTP and returns only its short-lived validation token", async () => {
    const { fetcher, requests } = recordingFetch({
      otp_validation_token: "otp-validation-token",
    });

    const token = await validateEgovSsoOtp({
      ...baseRequest,
      fetcher,
      otp: "123456",
    });

    expect(token).toBe("otp-validation-token");
    expect(await requestBody(requests[0]!)).toEqual({
      otp: "123456",
      partner_code: "partner-code",
      type: "EMAIL",
      username: "juan@example.test",
    });
  });

  test("authenticates the MPIN and returns only the one-time exchange code", async () => {
    const { fetcher, requests } = recordingFetch({ exchange_code: "exchange-code" });

    const exchangeCode = await authenticateEgovSsoMpin({
      ...baseRequest,
      fetcher,
      mpin: "654321",
      otpValidationToken: "otp-validation-token",
    });

    expect(exchangeCode).toBe("exchange-code");
    expect(await requestBody(requests[0]!)).toEqual({
      otp_validation_token: "otp-validation-token",
      partner_code: "partner-code",
      pin: "654321",
      username: "juan@example.test",
    });
  });

  test("preserves the provider retry delay when OTP requests are throttled", async () => {
    const { fetcher } = recordingFetch(
      {
        error: "throttle_otp_request",
        message: "Please wait before requesting another OTP.",
        meta: { seconds: 47 },
      },
      429,
    );

    try {
      await requestEgovSsoOtp({ ...baseRequest, fetcher });
      throw new Error("Expected requestEgovSsoOtp to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(EgovSsoRequestError);
      // SAFETY: the assertion above fails the test unless `error` is an
      // EgovSsoRequestError, so the throttle delay below is read off that class.
      expect((error as EgovSsoRequestError).retryAfterSeconds).toBe(47);
    }
  });
});
