import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type CardTone = "brand" | "navy" | "sky" | "success" | "warning" | "danger";

const ICON_TONE: Record<CardTone, string> = {
  brand: "bg-brand-soft text-brand",
  navy: "bg-navy-50 text-navy",
  sky: "bg-sky-soft text-sky",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
};

/** Ratio change (0.124 = +12,4%). null = no comparison available. */
export function Delta({ value, className, invert }: { value: number | null | undefined; className?: string; invert?: boolean }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn("text-xs font-medium text-muted-foreground", className)}>—</span>;
  }
  const up = value > 0.0005;
  const down = value < -0.0005;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const text = `${up ? "+" : ""}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-bold tabular-nums",
        good && "text-emerald-600",
        bad && "text-rose-600",
        !good && !bad && "text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {text}
    </span>
  );
}

function SurfaceCard({ className, href, children }: { className?: string; href?: string; children: React.ReactNode }) {
  const cls = cn(
    "rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-shadow",
    href && "hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );
  return href ? (
    <Link href={href} className={cn("block", cls)}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/**
 * KPI card (Dashboard / Relatórios): icon, big value, label and growth.
 * `value === undefined` renders the skeleton.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaInvert,
  hint,
  tone = "brand",
  href,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | undefined;
  delta?: number | null;
  deltaInvert?: boolean;
  hint?: string;
  tone?: CardTone;
  href?: string;
  className?: string;
}) {
  return (
    <SurfaceCard href={href} className={className}>
      <div className="flex items-start gap-4">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", ICON_TONE[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {value === undefined ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <div className="truncate text-2xl font-extrabold tracking-tight text-navy tabular-nums">{value}</div>
          )}
          <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
          {(delta !== undefined || hint) && (
            <div className="mt-2 flex items-center gap-2">
              {delta !== undefined && <Delta value={delta} invert={deltaInvert} />}
              {hint && <span className="truncate text-2xs text-muted-foreground">{hint}</span>}
            </div>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

/** Compact horizontal stat (Pagamentos / Avaliações headers). */
export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "brand",
  className,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | undefined;
  tone?: CardTone;
  className?: string;
  href?: string;
}) {
  return (
    <SurfaceCard href={href} className={cn("p-4", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", ICON_TONE[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          {value === undefined ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <div className="truncate text-lg font-extrabold text-navy tabular-nums">{value}</div>
          )}
          <div className="truncate text-2xs font-medium text-muted-foreground">{label}</div>
        </div>
      </div>
    </SurfaceCard>
  );
}

/** Card with an informative message (tips, warnings, explanations). */
export function InfoCard({
  icon: Icon,
  title,
  children,
  tone = "navy",
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
  tone?: CardTone;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card", className)}>
      {Icon && (
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", ICON_TONE[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-navy">{title}</div>
        {children && <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/**
 * Titled card section — the standard container for tables, charts and forms.
 * (ChartCard is the same with chart-friendly defaults.)
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  footer,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card shadow-card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-navy">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
      {footer && <footer className="border-t px-5 py-3">{footer}</footer>}
    </section>
  );
}

export function ChartCard(props: React.ComponentProps<typeof SectionCard> & { value?: React.ReactNode; delta?: number | null }) {
  const { value, delta, title, ...rest } = props;
  return (
    <SectionCard
      {...rest}
      title={
        <span className="flex flex-col gap-1">
          <span>{title}</span>
          {value !== undefined && (
            <span className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tracking-tight text-navy tabular-nums">{value}</span>
              {delta !== undefined && <Delta value={delta} />}
            </span>
          )}
        </span>
      }
    />
  );
}
