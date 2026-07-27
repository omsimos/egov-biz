"use client";

import {
  ArrowRightIcon,
  ShieldCheckIcon,
  UserFocusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { EGovLogo } from "@/components/egov-logo";
import { BagongPilipinasMark, CityscapeArt, DictSeal, NpcSeal } from "@/components/gov-seals";
import { StatusBar } from "@/components/phone-chrome";
import { ServiceLogo } from "@/components/service-logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { LastAccount, readLastAccount } from "@/lib/last-account";

declare global {
  interface Window {
    handleEgovSsoSuccess(exchangeCode: string): void;
  }
}

type LoginResponse = { authenticated: true; profile: CitizenProfile } | { error: string };

export function LoginScreen({ initialError }: { initialError?: string }) {
  const [exchangeCode, setExchangeCode] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [intentReady, setIntentReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastAccount, setLastAccount] = useState<LastAccount | null>(null);

  useEffect(() => {
    setLastAccount(readLastAccount());
  }, []);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const authenticate = useCallback(
    async (code: string) => {
      if (!code.trim() || loading) return;
      setLoading(true);
      setError("");
      setExchangeCode("");

      try {
        const response = await fetch("/api/auth/egov/exchange", {
          body: JSON.stringify({ exchangeCode: code.trim() }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const body = (await response.json()) as LoginResponse;
        if (!response.ok || "error" in body) {
          throw new Error("error" in body ? body.error : "Authentication failed.");
        }
        window.location.replace("/");
      } catch (authenticationError) {
        setError(
          authenticationError instanceof Error
            ? authenticationError.message
            : "eGov SSO authentication failed.",
        );
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  useEffect(() => {
    window.handleEgovSsoSuccess = (code: string) => {
      void authenticate(code);
    };
    return () => {
      window.handleEgovSsoSuccess = () => undefined;
    };
  }, [authenticate]);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/egov/intent", { cache: "no-store", method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not start eGov login.");
        if (active) setIntentReady(true);
      })
      .catch(() => {
        if (active) setError("Could not start a secure eGov login. Refresh and try again.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!intentReady || document.querySelector('script[data-egov-sso-widget="true"]')) return;
    const script = document.createElement("script");
    script.async = true;
    script.dataset.egovSsoWidget = "true";
    script.defer = true;
    script.src = "https://widgets.e.gov.ph/egov-hackathon-sso-widget.js";
    document.body.append(script);
  }, [intentReady]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void authenticate(exchangeCode);
  };

  return (
    <div className="screen text-foreground">
      <StatusBar />
      <main
        className="relative flex h-[calc(100%-36px)] min-h-[604px] flex-col overflow-x-hidden overflow-y-auto px-[22px] pt-[34px] [scrollbar-width:none] [@media(max-height:720px)]:pt-[25px] [&::-webkit-scrollbar]:hidden [&>*]:flex-none"
        id="app-content"
      >
        <div aria-hidden="true" className="flex h-12 items-center justify-center gap-[9px]">
          <BagongPilipinasMark className="size-[46px]" />
          <DictSeal className="size-[42px]" />
          <NpcSeal className="h-12 w-[38px]" />
        </div>

        <div className="mt-[13px] flex justify-center">
          <EGovLogo size={46} />
        </div>

        <header className="mt-[26px] text-center [@media(max-height:720px)]:mt-[22px]">
          <h1 className="text-xl leading-[1.15] -tracking-[.4px] text-foreground">
            Welcome back
            {lastAccount ? `, ${lastAccount.firstName.toUpperCase()}` : ""}
          </h1>
          <p className="mt-2.5 text-base font-medium text-muted-foreground">
            Enter your eGov exchange code
          </p>
        </header>

        <form
          className="relative z-[2] mt-7 grid gap-[9px] [@media(max-height:720px)]:mt-[23px]"
          onSubmit={submit}
        >
          <div className="flex items-center justify-between">
            <FieldLabel className="mb-0" htmlFor="exchange-code">
              Exchange code
            </FieldLabel>
            <button
              className="text-xs font-extrabold text-muted-foreground transition hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              data-cuelume-toggle="droplet"
              disabled={!exchangeCode || loading}
              onClick={() => setExchangeCode("")}
              type="button"
            >
              Clear
            </button>
          </div>
          <div className="relative">
            <Input
              aria-describedby={error ? "exchange-code-error" : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              className="h-[58px] pr-14 tracking-[0.5px]"
              id="exchange-code"
              onChange={(event) => setExchangeCode(event.target.value)}
              placeholder="Paste a fresh one-time code"
              spellCheck={false}
              type="password"
              value={exchangeCode}
            />
            <IconButton
              aria-label="Continue with exchange code"
              className="absolute top-1/2 right-2 -translate-y-1/2"
              data-cuelume-toggle="loading"
              disabled={!exchangeCode.trim() || !intentReady || loading}
              type="submit"
              variant="primary"
            >
              <ArrowRightIcon weight="bold" />
            </IconButton>
          </div>
          {error ? (
            <Alert className="mt-2.5" id="exchange-code-error" variant="destructive">
              <WarningCircleIcon weight="fill" />
              {error}
            </Alert>
          ) : null}
        </form>

        <a
          className="mx-auto mt-4 block w-fit text-sm font-bold text-primary no-underline"
          href="https://platforms.e.gov.ph/dashboard/api-catalogs/egov-sso"
          rel="noreferrer"
          target="_blank"
        >
          Forgot your code? Generate one
        </a>

        <Button
          className="mx-auto mt-3 w-fit"
          data-cuelume-toggle="page"
          disabled
          variant="outline"
        >
          <UserFocusIcon weight="regular" /> Login with Face ID
          <Badge variant="warning">Soon</Badge>
        </Button>

        <section
          aria-label="eGovPH sign in"
          className="relative z-[2] mt-[17px] grid justify-items-center"
        >
          <span className="text-xs font-bold text-gray-500">or</span>
          <div id="egov-sso-widget-button" />
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <ServiceLogo
              fallback={<ShieldCheckIcon className="size-4 text-success" weight="fill" />}
              height={16}
              service="egov-sso"
            />
            Secure eGovPH authentication
          </p>
        </section>

        <div className="relative z-[2] mt-[clamp(30px,5.5vh,56px)] mb-6 text-center [@media(max-height:720px)]:mt-[34px]">
          {lastAccount?.maskedMobile ? (
            <Badge variant="neutral">{lastAccount.maskedMobile}</Badge>
          ) : (
            <Badge variant="primary">Staging environment</Badge>
          )}
          <p className="mt-2.5 text-base font-medium text-foreground">
            Not you?{" "}
            <a
              className="ml-1 font-bold text-primary no-underline"
              href="https://platforms.e.gov.ph/dashboard/api-catalogs/egov-sso"
            >
              Switch Account
            </a>
          </p>
        </div>

        <div
          aria-hidden="true"
          className="relative mt-auto -mx-[22px] h-[212px] overflow-hidden pointer-events-none"
        >
          <BagongPilipinasMark className="absolute top-0 left-1/2 z-[1] size-[152px] -translate-x-1/2 drop-shadow-[0_3px_8px_rgba(20,40,90,.16)]" />
          <CityscapeArt className="absolute inset-x-0 bottom-0 z-[2] h-[150px] w-full" />
        </div>
      </main>
    </div>
  );
}
