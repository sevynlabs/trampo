/**
 * Formatting helpers for the admin panel. Monetary values are stored as
 * integer centavos everywhere; format to BRL only for display.
 */

/** centavos (int) -> "R$ 1.234,56" */
export function formatBRL(centavos: number | null | undefined): string {
  const value = (centavos ?? 0) / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Compact number, e.g. 1234 -> "1.234" */
export function formatNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("pt-BR");
}

/** 0.732 -> "73,2%" */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  return ((ratio ?? 0) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + "%";
}

/** ISO string -> "05/07/2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** ISO string -> "05/07/2026 14:30" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-06-22" (day bucket) -> "22/06" */
export function formatDayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}
