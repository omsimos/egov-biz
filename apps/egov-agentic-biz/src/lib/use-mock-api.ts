"use client";

import { useEffect, useState } from "react";

export function useMockApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Mock service unavailable");
        const payload = (await response.json()) as { data: T };
        setData(payload.data);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError("We could not load your mock government records.");
      }
    }

    void load();
    return () => controller.abort();
  }, [url]);

  return { data, error, loading: !data && !error };
}
