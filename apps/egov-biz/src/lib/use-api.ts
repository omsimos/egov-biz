"use client";

import { useEffect, useState } from "react";

export function useApi<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Request failed");
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
