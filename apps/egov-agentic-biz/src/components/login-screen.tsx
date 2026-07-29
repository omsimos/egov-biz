"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { EGovLogo } from "@/components/egov-logo";
import { BagongPilipinasMark, CityscapeArt, DictSeal, NpcSeal } from "@/components/gov-seals";
import { StatusBar } from "@/components/phone-chrome";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  authenticateEgovSsoMpin,
  checkEgovSsoPartner,
  EgovSsoRequestError,
  requestEgovSsoOtp,
  validateEgovSsoOtp,
} from "@/lib/auth/egov-login";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { clearLastAccount, type LastAccount, readLastAccount } from "@/lib/last-account";
import { cn, FOCUS_RING } from "@/lib/utils";

type LoginResponse = { authenticated: true; profile: CitizenProfile } | { error: string };
type LoginStep = "email" | "otp" | "mpin";

const OTP_RESEND_SECONDS = 180;
const stepNumber: Record<LoginStep, number> = { email: 1, mpin: 3, otp: 2 };

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  if (!domain) return email;
  const visibleLength = Math.max(1, Math.ceil(localPart.length / 2));
  return `${localPart.slice(0, visibleLength)}${"*".repeat(
    Math.max(1, localPart.length - visibleLength),
  )}@${domain}`;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function metaContent(name: string) {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content.trim() ?? "";
}

async function prepareSsoIntent() {
  const response = await fetch("/api/auth/egov/intent", {
    cache: "no-store",
    method: "POST",
  });
  if (!response.ok) throw new Error("Could not start a secure eGovPH login.");
}

async function exchangeForSession(exchangeCode: string) {
  // Refresh the short-lived, same-origin intent immediately before the server
  // exchange. A citizen can take longer than its five-minute TTL to retrieve
  // an OTP, and an expired intent must not make a valid MPIN look incorrect.
  await prepareSsoIntent();
  const response = await fetch("/api/auth/egov/exchange", {
    body: JSON.stringify({ exchangeCode }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const body = (await response.json()) as LoginResponse;
  if (!response.ok || "error" in body) {
    throw new Error("error" in body ? body.error : "Authentication failed.");
  }
}

export function LoginScreen({
  initialError,
  onBack,
}: {
  initialError?: string;
  // Returns to the landing composition. Absent below 760px and in the /preview
  // sandbox, where this screen is the whole page and there is nothing behind it.
  onBack?: () => void;
}) {
  const [apiUrl, setApiUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [lastAccount, setLastAccount] = useState<LastAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [mpin, setMpin] = useState("");
  const [otp, setOtp] = useState("");
  const [otpValidationToken, setOtpValidationToken] = useState("");
  const [ready, setReady] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [step, setStep] = useState<LoginStep>("email");
  const resendActive = step === "otp" && resendSeconds > 0;

  useEffect(() => {
    setLastAccount(readLastAccount());
  }, []);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  useEffect(() => {
    let active = true;
    const partnerCode = metaContent("egov-client-id");
    const configuredApiUrl = metaContent("egov-sso-api-url");
    if (!partnerCode || !configuredApiUrl) {
      setError("eGovPH SSO is not configured for this app.");
      return;
    }

    setApiUrl(configuredApiUrl);
    setClientId(partnerCode);
    void Promise.all([
      prepareSsoIntent(),
      checkEgovSsoPartner({ apiUrl: configuredApiUrl, partnerCode }),
    ])
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) {
          setError("Could not start a secure eGovPH login. Refresh and try again.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!resendActive) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [resendActive]);

  const resetToEmail = () => {
    setError("");
    setLoading(false);
    setMpin("");
    setOtp("");
    setOtpValidationToken("");
    setResendSeconds(0);
    setStep("email");
  };

  const requestOtp = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const normalizedEmail = email.trim();
    if (!ready || loading || !normalizedEmail) return;

    setLoading(true);
    setError("");
    try {
      await requestEgovSsoOtp({
        apiUrl,
        email: normalizedEmail,
        partnerCode: clientId,
      });
      setEmail(normalizedEmail);
      setOtp("");
      setResendSeconds(OTP_RESEND_SECONDS);
      setStep("otp");
    } catch (requestError) {
      if (
        requestError instanceof EgovSsoRequestError &&
        requestError.retryAfterSeconds !== undefined
      ) {
        setResendSeconds(requestError.retryAfterSeconds);
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "eGovPH could not send an OTP to this email.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || loading || otp.length !== 6) return;

    setLoading(true);
    setError("");
    try {
      const token = await validateEgovSsoOtp({
        apiUrl,
        email,
        otp,
        partnerCode: clientId,
      });
      setOtp("");
      setOtpValidationToken(token);
      setStep("mpin");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "That OTP could not be verified.",
      );
    } finally {
      setLoading(false);
    }
  };

  const authenticateMpin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || loading || mpin.length !== 6 || !otpValidationToken) return;

    setLoading(true);
    setError("");
    try {
      const exchangeCode = await authenticateEgovSsoMpin({
        apiUrl,
        email,
        mpin,
        otpValidationToken,
        partnerCode: clientId,
      });
      await exchangeForSession(exchangeCode);
      setMpin("");
      setOtpValidationToken("");
      window.location.replace("/");
    } catch (authenticationError) {
      setMpin("");
      setError(
        authenticationError instanceof Error
          ? authenticationError.message
          : "eGovPH could not complete authentication.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen text-foreground">
      <StatusBar />
      {/* A sibling of <main>, not a child of it. Inside, it was positioned against
          main's padding box and so needed a negative `left` to reach the design's
          14px inset — which main's own `overflow-x: hidden` then clipped by 8px.
          It also scrolled away with the form, and this is frame chrome: it belongs
          to the phone, not to the content. Positioned against .screen instead, so
          the inset is the design's plain 14px and it stays put. */}
      {onBack ? (
        <button
          aria-label="Back to eGOVbusiness"
          className={cn(
            "absolute top-[52px] left-[14px] z-10 grid size-[38px] place-items-center rounded-full bg-muted text-foreground",
            "transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-gray-200 active:scale-[var(--press-sm)] motion-reduce:transition-none",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-[17px]" weight="bold" />
        </button>
      ) : null}
      <main
        className="relative flex h-[calc(100%-36px)] min-h-[604px] flex-col overflow-x-hidden overflow-y-auto px-[22px] pt-[25px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:flex-none"
        id="app-content"
      >
        <div aria-hidden="true" className="flex h-12 items-center justify-center gap-[9px]">
          <BagongPilipinasMark className="size-[46px]" />
          <DictSeal className="size-[42px]" />
          <NpcSeal className="h-12 w-[38px]" />
        </div>

        <div className="mt-[13px] flex justify-center">
          <EGovLogo priority size={46} />
        </div>

        <header className="mt-[20px] text-center">
          <p className="mb-2 text-xs font-black tracking-[0.08em] text-primary uppercase">
            Step {stepNumber[step]} of 3
          </p>
          <h1 className="text-xl leading-[1.15] -tracking-[.4px] text-foreground">
            {step === "email"
              ? lastAccount
                ? `Sign in again, ${lastAccount.firstName}`
                : "Sign in to eGovPH"
              : step === "otp"
                ? "Check your email"
                : "Enter your MPIN"}
          </h1>
          <p className="mt-2.5 text-sm font-medium text-muted-foreground">
            {step === "email"
              ? lastAccount
                ? "This device remembers your previous account, but you are currently signed out."
                : "Use the email linked to your eGovPH account"
              : step === "otp"
                ? `We sent a 6-digit OTP to ${maskEmail(email)}`
                : "Use your 6-digit eGovPH passcode to finish signing in"}
          </p>
        </header>

        <div aria-hidden="true" className="mt-5 grid grid-cols-3 gap-2">
          {(["email", "otp", "mpin"] as const).map((item) => (
            <span
              className={cn(
                "h-1.5 rounded-full transition-colors",
                stepNumber[item] <= stepNumber[step] ? "bg-primary" : "bg-muted",
              )}
              key={item}
            />
          ))}
        </div>

        <section aria-label="eGovPH sign in" aria-live="polite" className="mt-6">
          {step === "email" ? (
            <form className="grid gap-4" onSubmit={(event) => void requestOtp(event)}>
              <div>
                <FieldLabel htmlFor="egov-email">Email address</FieldLabel>
                <Input
                  aria-describedby={error ? "egov-login-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  autoComplete="username"
                  autoFocus
                  className="h-[56px]"
                  disabled={!ready || loading}
                  id="egov-email"
                  inputMode="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  spellCheck={false}
                  type="email"
                  value={email}
                />
              </div>
              <Button block disabled={!ready || loading || !email.trim()} size="lg" type="submit">
                {loading ? "Sending OTP…" : "Continue"}
                {!loading ? <ArrowRightIcon weight="bold" /> : null}
              </Button>
            </form>
          ) : null}

          {step === "otp" ? (
            <form className="grid gap-4" onSubmit={(event) => void verifyOtp(event)}>
              <div>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="egov-otp">One-time password</FieldLabel>
                  <button
                    className={cn("mb-1.5 text-xs font-extrabold text-primary", FOCUS_RING)}
                    disabled={loading}
                    onClick={resetToEmail}
                    type="button"
                  >
                    Change email
                  </button>
                </div>
                <Input
                  aria-describedby={error ? "egov-login-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  autoComplete="one-time-code"
                  autoFocus
                  className="h-[58px] text-center text-xl font-extrabold tracking-[0.36em] tabular-nums"
                  disabled={loading}
                  id="egov-otp"
                  inputMode="numeric"
                  maxLength={6}
                  name="otp"
                  onChange={(event) => setOtp(digitsOnly(event.target.value))}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  required
                  type="text"
                  value={otp}
                />
              </div>
              <Button block disabled={loading || otp.length !== 6} size="lg" type="submit">
                {loading ? "Verifying…" : "Verify OTP"}
                {!loading ? <ArrowRightIcon weight="bold" /> : null}
              </Button>
              <button
                className={cn(
                  "mx-auto w-fit text-sm font-bold text-primary disabled:text-muted-foreground",
                  FOCUS_RING,
                )}
                disabled={loading || resendSeconds > 0}
                onClick={() => void requestOtp()}
                type="button"
              >
                {resendSeconds > 0
                  ? `Resend OTP in ${formatCountdown(resendSeconds)}`
                  : "Resend OTP"}
              </button>
            </form>
          ) : null}

          {step === "mpin" ? (
            <form className="grid gap-4" onSubmit={(event) => void authenticateMpin(event)}>
              <div>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="egov-mpin">MPIN</FieldLabel>
                  <button
                    className={cn("mb-1.5 text-xs font-extrabold text-primary", FOCUS_RING)}
                    disabled={loading}
                    onClick={resetToEmail}
                    type="button"
                  >
                    Use another email
                  </button>
                </div>
                <Input
                  aria-describedby={error ? "egov-login-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  autoComplete="current-password"
                  autoFocus
                  className="h-[58px] text-center text-xl font-extrabold tracking-[0.36em] tabular-nums"
                  disabled={loading}
                  id="egov-mpin"
                  inputMode="numeric"
                  maxLength={6}
                  name="mpin"
                  onChange={(event) => setMpin(digitsOnly(event.target.value))}
                  pattern="[0-9]{6}"
                  placeholder="••••••"
                  required
                  type="password"
                  value={mpin}
                />
              </div>
              <Button block disabled={loading || mpin.length !== 6} size="lg" type="submit">
                {loading ? "Signing in…" : "Sign in securely"}
                {!loading ? <ArrowRightIcon weight="bold" /> : null}
              </Button>
              <button
                className={cn(
                  "mx-auto inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground",
                  FOCUS_RING,
                )}
                disabled={loading}
                onClick={resetToEmail}
                type="button"
              >
                <ArrowLeftIcon weight="bold" />
                Start over
              </button>
            </form>
          ) : null}

          {error ? (
            <Alert className="mt-4" id="egov-login-error" variant="destructive">
              <WarningCircleIcon weight="fill" />
              {error}
            </Alert>
          ) : null}

          <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-xs leading-[1.4] text-muted-foreground">
            <ShieldCheckIcon className="mt-px size-4 shrink-0 text-success" weight="fill" />
            Email, OTP, and MPIN go directly to eGovPH and are never stored by this app.
          </p>
        </section>

        {process.env.NODE_ENV !== "production" ? (
          <a
            className={cn(
              "relative z-[2] mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-warning-border bg-warning-soft px-3 py-2.5 text-sm font-bold text-warning-ink no-underline",
              "transition-[scale,background-color] duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]",
              FOCUS_RING,
            )}
            href="/api/auth/dev-login"
          >
            <WrenchIcon className="size-4" weight="fill" />
            Skip sign-in — local dev session
          </a>
        ) : null}

        <div className="relative z-[2] mt-5 text-center">
          {lastAccount?.maskedMobile ? (
            <Badge variant="neutral">{lastAccount.maskedMobile}</Badge>
          ) : (
            <Badge variant="primary">Staging environment</Badge>
          )}
          {lastAccount ? (
            <p className="mt-2.5 text-sm font-medium text-foreground">
              Not you?{" "}
              <button
                className={cn("ml-1 font-bold text-primary", FOCUS_RING)}
                onClick={() => {
                  clearLastAccount();
                  setLastAccount(null);
                  setEmail("");
                  resetToEmail();
                }}
                type="button"
              >
                Switch Account
              </button>
            </p>
          ) : null}
        </div>

        <div
          aria-hidden="true"
          className="relative mt-auto -mx-[22px] h-[112px] overflow-hidden pointer-events-none"
        >
          <BagongPilipinasMark className="absolute top-0 left-1/2 z-[1] size-[78px] -translate-x-1/2 drop-shadow-[0_3px_8px_rgba(20,40,90,.16)]" />
          <CityscapeArt className="absolute inset-x-0 bottom-0 z-[2] h-[82px] w-full" />
        </div>
      </main>
    </div>
  );
}
