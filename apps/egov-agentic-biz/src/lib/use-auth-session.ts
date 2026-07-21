"use client";

import { useCallback, useEffect, useState } from "react";
import type { CitizenProfile } from "@/lib/citizen-profile";

type AuthSessionResponse =
  | { authenticated: false; profile: null }
  | { authenticated: true; profile: CitizenProfile };

export function useAuthSession() {
  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [status, setStatus] = useState<"anonymous" | "authenticated" | "loading">("loading");
  const [error, setError] = useState("");

  const restore = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const body = (await response.json()) as AuthSessionResponse | { error: string };
      if (!response.ok || "error" in body) throw new Error("Could not restore the session.");
      if (body.authenticated) {
        setProfile(body.profile);
        setStatus("authenticated");
      } else {
        setProfile(null);
        setStatus("anonymous");
      }
    } catch {
      setProfile(null);
      setStatus("anonymous");
      setError("We could not check your eGovPH session. Try again.");
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  const logout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", { cache: "no-store", method: "POST" });
    if (!response.ok) throw new Error("Could not sign out.");
    setProfile(null);
    setStatus("anonymous");
  }, []);

  return { error, logout, profile, restore, status };
}
