"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isPeriod, type Period } from "@/constants/period";
import { usePanelPrefs } from "@/hooks/use-panel-prefs";

/**
 * List/page state kept in the URL (?q=&page=&status=…) so filters survive
 * reloads, are shareable and back/forward works. Every list page uses it.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo(() => {
    const out = { ...defaults } as Record<string, string>;
    for (const k of Object.keys(defaults)) {
      const v = params.get(k);
      if (v !== null) out[k] = v;
    }
    return out as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const set = useCallback(
    (patch: Partial<T>, opts: { resetPage?: boolean } = { resetPage: true }) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || v === defaults[k]) next.delete(k);
        else next.set(k, String(v));
      }
      if (opts.resetPage && !("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, pathname, router]
  );

  return [state, set] as const;
}

/**
 * Period used when the URL has no `?period=`: the admin's preferred default
 * (Configurações → Painel), else DEFAULT_PERIOD. Before mount it is always
 * DEFAULT_PERIOD, so server and client markup match.
 */
export function usePreferredPeriod(): Period {
  return usePanelPrefs().defaultPeriod;
}

/** Global period (?period=30d), shared by the Topbar selector and pages. */
export function usePeriod(): [Period, (p: Period) => void] {
  // Default "" (not a period) so an explicit choice is always written to the URL,
  // even when it equals the preferred default.
  const [state, set] = useUrlState({ period: "" });
  const preferred = usePreferredPeriod();
  const period = isPeriod(state.period) ? state.period : preferred;
  return [period, (p: Period) => set({ period: p }, { resetPage: true })];
}

/** Debounce a fast-changing value (search inputs). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
