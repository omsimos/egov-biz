"use client";

import { useEffect, useState } from "react";

export function useApi<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dropping the record the moment the hook is switched off, during the render
  // that switches it off rather than in the effect below. Masking it at the
  // return site instead would leave the old record in state, and it would flash
  // when `enabled` comes back before the refetch resolves.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) {
      setData(null);
      setError(null);
    }
  }

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Request failed");
        // SAFETY: every eGov record route this hook is pointed at answers with a
        // `{ data }` envelope, and the non-ok case threw on the line above. T is
        // the calling component's claim about what that envelope carries.
        const payload = (await response.json()) as { data: T };
        setData(payload.data);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError("We could not load this eGov record.");
      }
    }

    void load();
    return () => controller.abort();
  }, [enabled, url]);

  return { data, error, loading: enabled && !data && !error };
}
