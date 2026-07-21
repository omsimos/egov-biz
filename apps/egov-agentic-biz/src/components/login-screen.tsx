"use client";

import { ArrowRight, ShieldCheck, UserFocus } from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { EGovLogo } from "@/components/egov-logo";
import { BagongPilipinasMark, CityscapeArt, DictSeal, NpcSeal } from "@/components/gov-seals";
import { StatusBar } from "@/components/phone-chrome";
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
    <div className="screen login-screen">
      <StatusBar />
      <main className="login-content" id="app-content">
        <div className="login-government-marks" aria-hidden="true">
          <BagongPilipinasMark className="seal-bp" />
          <DictSeal className="seal-dict" />
          <NpcSeal className="seal-npc" />
        </div>

        <div className="login-logo-row">
          <EGovLogo size={46} />
        </div>

        <header className="login-welcome">
          <h1>
            Welcome back
            {lastAccount ? `, ${lastAccount.firstName.toUpperCase()}` : ""}
          </h1>
          <p>Enter your eGov exchange code</p>
        </header>

        <form className="test-code-form" onSubmit={submit}>
          <div className="test-code-label">
            <label htmlFor="exchange-code">Exchange code</label>
            <button
              data-cuelume-toggle="droplet"
              disabled={!exchangeCode || loading}
              onClick={() => setExchangeCode("")}
              type="button"
            >
              Clear
            </button>
          </div>
          <div className="test-code-field">
            <input
              autoComplete="off"
              id="exchange-code"
              onChange={(event) => setExchangeCode(event.target.value)}
              placeholder="Paste a fresh one-time code"
              spellCheck={false}
              type="password"
              value={exchangeCode}
            />
            <button
              aria-label="Continue with exchange code"
              data-cuelume-toggle="loading"
              disabled={!exchangeCode.trim() || !intentReady || loading}
              type="submit"
            >
              <ArrowRight weight="bold" />
            </button>
          </div>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <a
          className="login-code-help"
          href="https://platforms.e.gov.ph/dashboard/api-catalogs/egov-sso"
          rel="noreferrer"
          target="_blank"
        >
          Forgot your code? Generate one
        </a>

        <button className="faceid-pill" data-cuelume-toggle="page" type="button">
          <UserFocus weight="regular" /> Login with Face ID
        </button>

        <section className="official-login" aria-label="eGovPH sign in">
          <span>or</span>
          <div id="egov-sso-widget-button" />
          <p>
            <ShieldCheck weight="fill" /> Secure eGovPH authentication
          </p>
        </section>

        <div className="login-account-switch">
          {lastAccount?.maskedMobile ? (
            <small className="masked-chip">{lastAccount.maskedMobile}</small>
          ) : (
            <small>Staging environment</small>
          )}
          <p>
            Not you?{" "}
            <a href="https://platforms.e.gov.ph/dashboard/api-catalogs/egov-sso">Switch Account</a>
          </p>
        </div>

        <div className="login-cityscape" aria-hidden="true">
          <BagongPilipinasMark className="cityscape-bp" />
          <CityscapeArt className="cityscape-art" />
        </div>
      </main>
    </div>
  );
}
