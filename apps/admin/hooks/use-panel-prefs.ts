"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PERIOD, isPeriod, type Period } from "@/constants/period";

/**
 * Browser-only panel preferences (localStorage). Nothing here is sent to the
 * API — each admin/browser keeps its own choices. Saved from Configurações →
 * Painel; read by `DataTable` (density) and `usePeriod()` (default period).
 */
export const PANEL_PREFS_KEY = "trampo-admin:panel-prefs";

/** Dispatched on `window` after the prefs are saved in this tab. */
export const PANEL_PREFS_EVENT = "trampo-admin:panel-prefs-change";

export type TableDensity = "comfortable" | "compact";
export type PanelPrefs = { density: TableDensity; defaultPeriod: Period };

export const DEFAULT_PANEL_PREFS: PanelPrefs = { density: "comfortable", defaultPeriod: DEFAULT_PERIOD };

function parse(raw: string | null): PanelPrefs {
  if (!raw) return DEFAULT_PANEL_PREFS;
  try {
    const p = JSON.parse(raw) as Partial<PanelPrefs>;
    return {
      density: p.density === "compact" ? "compact" : "comfortable",
      defaultPeriod: isPeriod(p.defaultPeriod) ? p.defaultPeriod : DEFAULT_PERIOD,
    };
  } catch {
    return DEFAULT_PANEL_PREFS;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(PANEL_PREFS_KEY);
  } catch {
    return null;
  }
}

/** Reads the saved prefs (defaults when absent, invalid or storage is blocked). Client only. */
export function readPanelPrefs(): PanelPrefs {
  if (typeof window === "undefined") return DEFAULT_PANEL_PREFS;
  return parse(readRaw());
}

/** Persists the prefs and notifies every mounted `usePanelPrefs()`. Returns false if storage is blocked. */
export function writePanelPrefs(p: PanelPrefs): boolean {
  try {
    window.localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(p));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(PANEL_PREFS_EVENT));
  return true;
}

// useSyncExternalStore needs a stable snapshot: cache by the raw string.
let cachedRaw: string | null | undefined;
let cachedPrefs: PanelPrefs = DEFAULT_PANEL_PREFS;

function getSnapshot(): PanelPrefs {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPrefs = parse(raw);
  }
  return cachedPrefs;
}

/** Server render + hydration use the defaults, so markup always matches; the real prefs apply right after. */
function getServerSnapshot(): PanelPrefs {
  return DEFAULT_PANEL_PREFS;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PANEL_PREFS_KEY) onChange();
  };
  window.addEventListener("storage", onStorage); // other tabs
  window.addEventListener(PANEL_PREFS_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PANEL_PREFS_EVENT, onChange);
  };
}

/** Live panel preferences — updates without reload when saved here or in another tab. */
export function usePanelPrefs(): PanelPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
