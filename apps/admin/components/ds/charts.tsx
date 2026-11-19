"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Dependency-free SVG charts with the Trampo look (orange series, navy text,
 * soft grid). Scale with the container (viewBox + w-full).
 *
 * Chart rules: one accent colour per series (brand orange first, then sky,
 * navy), light horizontal grid, values formatted by the caller, empty state
 * text when there is no data.
 */

export type SeriesPoint = { label: string; value: number; secondary?: number };

export const CHART_COLORS = {
  brand: "#FF6A00",
  sky: "#0096D6",
  navy: "#041E42",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#F43F5E",
  neutral: "#94A3B8",
};

function Empty({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground" style={{ height }}>
      Sem dados no período
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Area/line chart with gradient fill, grid, axis labels and hover tooltip. */
export function AreaChart({
  data,
  height = 220,
  formatValue = (v) => v.toLocaleString("pt-BR"),
  color = CHART_COLORS.brand,
  secondaryColor = CHART_COLORS.sky,
  seriesLabels = ["Valor", "Comparativo"],
  className,
}: {
  data: SeriesPoint[];
  height?: number;
  formatValue?: (v: number) => string;
  color?: string;
  secondaryColor?: string;
  seriesLabels?: [string, string?];
  className?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <Empty height={height} />;

  const W = 640;
  const H = height;
  const pad = { top: 16, right: 12, bottom: 26, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const hasSecondary = data.some((d) => d.secondary !== undefined);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1));
  const x = (i: number) => pad.left + (data.length > 1 ? (i * innerW) / (data.length - 1) : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const path = (key: "value" | "secondary") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y((d[key] ?? 0) as number).toFixed(1)}`).join(" ");
  const area = `${path("value")} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const compact = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Gráfico de evolução"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <text x={pad.left - 8} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground">
              {compact(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#g${gid})`} />
        {hasSecondary && (
          <path d={path("secondary")} fill="none" stroke={secondaryColor} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
        )}
        <path d={path("value")} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
                {d.label}
              </text>
            )}
            <rect
              x={x(i) - innerW / Math.max(data.length, 1) / 2}
              y={pad.top}
              width={innerW / Math.max(data.length, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="hsl(var(--border))" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r={4.5} fill="#fff" stroke={color} strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl border bg-card px-3 py-2 text-xs shadow-card-hover"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <div className="font-semibold text-navy">{data[hover].label}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {seriesLabels[0]}: <b className="tabular-nums">{formatValue(data[hover].value)}</b>
          </div>
          {hasSecondary && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: secondaryColor }} />
              {seriesLabels[1]}: <b className="tabular-nums">{formatValue(data[hover].secondary ?? 0)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Donut with total in the centre and a legend with percentages. */
export function DonutChart({
  data,
  size = 168,
  centerLabel = "Total",
  formatValue = (v) => v.toLocaleString("pt-BR"),
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  formatValue?: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 15.9155;
  let offset = 25;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label="Distribuição">
          <circle cx="21" cy="21" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5.5" />
          {total > 0 &&
            data.map((d) => {
              const pct = (d.value / total) * 100;
              const el = (
                <circle
                  key={d.label}
                  cx="21"
                  cy="21"
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="5.5"
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeDashoffset={offset}
                >
                  <title>{`${d.label}: ${formatValue(d.value)}`}</title>
                </circle>
              );
              offset -= pct;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-navy tabular-nums">{formatValue(total)}</span>
          <span className="text-2xs font-medium text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate text-muted-foreground">{d.label}</span>
            <span className="font-bold tabular-nums text-navy">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars (rankings: serviços por categoria…). */
export function HBarChart({
  data,
  formatValue = (v) => v.toLocaleString("pt-BR"),
  color = CHART_COLORS.sky,
  max: maxItems = 8,
}: {
  data: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  color?: string;
  max?: number;
}) {
  if (data.length === 0) return <Empty height={160} />;
  const rows = data.slice(0, maxItems);
  const max = Math.max(...rows.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(84px,140px)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%`, background: color }}
            />
          </span>
          <span className="min-w-[3rem] text-right font-bold tabular-nums text-navy">{formatValue(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}
