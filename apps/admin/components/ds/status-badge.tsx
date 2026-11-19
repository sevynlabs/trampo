import { cn } from "@/lib/utils";
import { statusDef, type StatusDef, type StatusTone } from "@/constants/status";

const TONE_CLASS: Record<StatusTone, { badge: string; dot: string }> = {
  success: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", dot: "bg-emerald-500" },
  info: { badge: "bg-sky-soft text-[#0077AA] ring-sky/20", dot: "bg-sky" },
  warning: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  danger: { badge: "bg-rose-50 text-rose-700 ring-rose-600/15", dot: "bg-rose-500" },
  neutral: { badge: "bg-slate-100 text-slate-600 ring-slate-500/15", dot: "bg-slate-400" },
  brand: { badge: "bg-brand-soft text-brand ring-brand/20", dot: "bg-brand" },
  navy: { badge: "bg-navy-50 text-navy ring-navy/15", dot: "bg-navy" },
};

type Props =
  | { map: Record<string, StatusDef>; status: string | null | undefined; tone?: never; label?: never; className?: string; dot?: boolean }
  | { tone: StatusTone; label: string; map?: never; status?: never; className?: string; dot?: boolean };

/**
 * The single status pill of the panel. Pass a status map from
 * `constants/status.ts` + the raw status, or an explicit tone + label.
 */
export function StatusBadge(props: Props) {
  const def = props.map ? statusDef(props.map, props.status) : { label: props.label, tone: props.tone };
  const cls = TONE_CLASS[def.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        cls.badge,
        props.className
      )}
    >
      {props.dot !== false && <span className={cn("h-1.5 w-1.5 rounded-full", cls.dot)} aria-hidden />}
      {def.label}
    </span>
  );
}

/** Small neutral tag (categories, roles…). */
export function Tag({ children, tone = "navy", className }: { children: React.ReactNode; tone?: StatusTone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold", TONE_CLASS[tone].badge, className)}>
      {children}
    </span>
  );
}
