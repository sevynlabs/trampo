"use client";

/**
 * Dependency-free SVG charts for the admin dashboard. Uniform scaling
 * (viewBox + w-full), theme-aware via `currentColor` / shadcn tokens.
 */

type Point = { label: string; value: number };

export function LineChart({
  data,
  height = 160,
  formatValue = (v) => String(v),
  className,
}: {
  data: Point[];
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const W = 600;
  const H = height;
  const pad = { top: 12, right: 8, bottom: 22, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Sem dados no período
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => pad.left + (data.length > 1 ? i * stepX : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `${pad.left},${pad.top + innerH} ${line} ${x(data.length - 1)},${
    pad.top + innerH
  }`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full text-primary ${className ?? ""}`}
      style={{ height: "auto" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <polyline points={area} fill="currentColor" opacity={0.08} stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r={2.5} fill="currentColor">
            <title>{`${d.label}: ${formatValue(d.value)}`}</title>
          </circle>
          {(i === 0 || i === data.length - 1 || data.length <= 12) && (
            <text
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function BarChart({
  data,
  formatValue = (v) => String(v),
}: {
  data: { label: string; value: number; tone?: "default" | "muted" | "danger" }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const tone = {
    default: "bg-primary",
    muted: "bg-muted-foreground/40",
    danger: "bg-destructive",
  } as const;

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-medium tabular-nums">{formatValue(d.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${tone[d.tone ?? "default"]}`}
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
