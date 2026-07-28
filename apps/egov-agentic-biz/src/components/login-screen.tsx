"use client";

import {
  ArrowRightIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { EGovLogo } from "@/components/egov-logo";
import { BagongPilipinasMark, CityscapeArt, DictSeal, NpcSeal } from "@/components/gov-seals";
import { StatusBar } from "@/components/phone-chrome";
import { ServiceLogo } from "@/components/service-logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { clearLastAccount, LastAccount, readLastAccount } from "@/lib/last-account";
import { cn, FOCUS_RING } from "@/lib/utils";

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
  // The code path stays reachable, just not first. An error means a code was
  // already attempted, so the form has to be open to show it.
  const [codeOpen, setCodeOpen] = useState(Boolean(initialError));

  useEffect(() => {
    setLastAccount(readLastAccount());
  }, []);

  useEffect(() => {
    if (!initialError) return;
    setError(initialError);
    // An exchange-code error has to be visible, so the collapsed form opens.
    setCodeOpen(true);
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
          <EGovLogo priority size={46} />
        </div>

        <header className="mt-[26px] text-center [@media(max-height:720px)]:mt-[22px]">
          {/* Not .toUpperCase(). A citizen's own name was the last shouted string
              left in the app, and the profile already stores the right case. */}
          <h1 className="text-xl leading-[1.15] -tracking-[.4px] text-foreground">
            Welcome back{lastAccount ? `, ${lastAccount.firstName}` : ""}
          </h1>
          <p className="mt-2.5 text-base font-medium text-muted-foreground">
            {codeOpen ? "Enter your eGov exchange code" : "Sign in with your eGovPH account"}
          </p>
        </header>

        {/* eGovPH SSO leads. The exchange code is a one-time string minted by a
            developer console — it is how this prototype is driven and it has to
            stay reachable, but it is not what a citizen signs in with, and it
            used to occupy the whole top of the screen. */}
        <section
          aria-label="eGovPH sign in"
          className="relative z-[2] mt-7 grid justify-items-center gap-2.5 [@media(max-height:720px)]:mt-[23px]"
        >
          {/* The widget injects its own button here; we own the box, not the
              button inside it, so this reserves full width and a stable height
              rather than restyling markup from widgets.e.gov.ph. */}
          <div
            className="grid min-h-[54px] w-full place-items-center"
            id="egov-sso-widget-button"
          />
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <ServiceLogo
              fallback={<ShieldCheckIcon className="size-4 text-success" weight="fill" />}
              height={16}
              service="egov-sso"
            />
            Secure eGovPH authentication
          </p>
        </section>

        {codeOpen ? (
          <form className="relative z-[2] mt-5 grid gap-[9px]" onSubmit={submit}>
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
                autoFocus
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
            <a
              className="mx-auto mt-1 block w-fit text-sm font-bold text-primary no-underline"
              href="https://platforms.e.gov.ph/dashboard/api-catalogs/egov-sso"
              rel="noreferrer"
              target="_blank"
            >
              Forgot your code? Generate one
            </a>
          </form>
        ) : (
          <button
            className={cn(
              "mx-auto mt-3.5 block w-fit text-sm font-bold text-muted-foreground transition hover:text-foreground",
              FOCUS_RING,
            )}
            onClick={() => setCodeOpen(true)}
            type="button"
          >
            Have an exchange code? Enter it instead
          </button>
        )}

        {/* Local dev only, and deliberately not a fake success.
            The MPIN step in the eGovPH widget is validated by
            hackathon-sso.e.gov.ph; a rejected MPIN means no exchange code, and
            an exchange code cannot be produced here, because minting one is the
            entire job of their server. So this does not pretend the widget
            succeeded — it skips it and mints a real session through the same
            createSession a genuine exchange calls, which is why everything
            downstream (chat, tools, prefill, eGovPay) behaves normally.
            Dashed and warning-toned so it never reads as part of the product.
            Two guards, as with /preview: NODE_ENV is inlined at build time so
            this element is absent from a production bundle, and the route
            itself 404s outside dev and off loopback. */}
        {process.env.NODE_ENV !== "production" && (
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
        )}

        <div className="relative z-[2] mt-[clamp(30px,5.5vh,56px)] mb-6 text-center [@media(max-height:720px)]:mt-[34px]">
          {lastAccount?.maskedMobile ? (
            <Badge variant="neutral">{lastAccount.maskedMobile}</Badge>
          ) : (
            <Badge variant="primary">Staging environment</Badge>
          )}
          {lastAccount ? (
            <p className="mt-2.5 text-base font-medium text-foreground">
              Not you?{" "}
              {/* Was a link to the eGov API catalog, which switched nothing. The
                  remembered account is the only thing this screen persists, so
                  forgetting it is the entire action. */}
              <button
                className={cn("ml-1 font-bold text-primary", FOCUS_RING)}
                onClick={() => {
                  clearLastAccount();
                  setLastAccount(null);
                }}
                type="button"
              >
                Switch Account
              </button>
            </p>
          ) : null}
        </div>

        {/* 132px, not 212. At the old size the mark alone was 152px tall and the
            content above already filled an 844px viewport, so a citizen saw the
            top third of a starburst and no cityscape at all. */}
        <div
          aria-hidden="true"
          className="relative mt-auto -mx-[22px] h-[132px] overflow-hidden pointer-events-none"
        >
          <BagongPilipinasMark className="absolute top-0 left-1/2 z-[1] size-[92px] -translate-x-1/2 drop-shadow-[0_3px_8px_rgba(20,40,90,.16)]" />
          <CityscapeArt className="absolute inset-x-0 bottom-0 z-[2] h-[96px] w-full" />
        </div>
      </main>
    </div>
  );
}
