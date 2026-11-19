"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIODS, type Period } from "@/constants/period";
import { useDebouncedValue } from "@/hooks/use-url-state";

/** Search field with icon, clear button and built-in debounce. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  delay = 350,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, delay);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className={cn("relative min-w-[220px] flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground hover:border-navy/25 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            onChange("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Limpar busca"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export type FilterOption = { value: string; label: string };

/** Labelled select used in filter bars (caption above, like the reference). */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  className?: string;
}) {
  return (
    <div className={cn("min-w-[150px]", className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 flex-col items-start justify-center gap-0 py-1 text-left [&>svg]:absolute [&>svg]:right-3 relative pr-8" aria-label={label}>
          <span className="text-2xs font-medium leading-none text-muted-foreground">{label}</span>
          <span className="w-full truncate text-sm font-semibold leading-tight text-foreground">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PeriodSelect({ value, onChange, className }: { value: Period; onChange: (p: Period) => void; className?: string }) {
  return (
    <FilterSelect
      label="Período"
      value={value}
      onChange={(v) => onChange(v as Period)}
      options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
      className={className}
    />
  );
}

/** Row that holds search + filters above a table. Wraps on small screens. */
export function FilterBar({ children, className, actions }: { children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center", className)}>
      <div className="flex flex-1 flex-wrap items-center gap-3">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
