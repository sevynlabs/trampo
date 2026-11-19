/** Period filter shared by Topbar, dashboards and list filters (mirrors the API). */
export const PERIODS = [
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
  { value: "12m", label: "Últimos 12 meses", days: 365 },
  { value: "all", label: "Todo o período", days: null },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export const DEFAULT_PERIOD: Period = "30d";

export function isPeriod(v: string | null | undefined): v is Period {
  return PERIODS.some((p) => p.value === v);
}

export function periodLabel(p: Period): string {
  return PERIODS.find((x) => x.value === p)?.label ?? p;
}

/** Days for endpoints that take `days` (dashboard series): capped to the API range 7..90. */
export function periodDays(p: Period): number {
  const d = PERIODS.find((x) => x.value === p)?.days ?? 90;
  return Math.min(Math.max(d, 7), 90);
}
