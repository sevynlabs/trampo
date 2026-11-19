"use client";

import { Copy, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function initials(name?: string | null): string {
  return (
    (name ?? "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

const SIZE = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8", md: "h-9 w-9", lg: "h-12 w-12 text-sm", xl: "h-16 w-16 text-lg" } as const;

export function UserAvatar({
  name,
  src,
  size = "md",
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZE[size], className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** "TR4F9A2C" → "TR-4F9A2C" (idempotent; same format the app shows). */
export function formatPublicCode(code?: string | null): string | null {
  if (!code) return null;
  return code.includes("-") ? code : `${code.slice(0, 2)}-${code.slice(2)}`;
}

/**
 * The user's in-app ID ("ID no Trampo") — the quick way to identify a
 * client or professional. Same code the user sees in the app profile and
 * on the business card. `copyable` adds a copy button.
 */
export function PublicId({
  code,
  copyable = true,
  size = "sm",
  className,
}: {
  code?: string | null;
  copyable?: boolean;
  size?: "xs" | "sm";
  className?: string;
}) {
  const id = formatPublicCode(code);
  if (!id) return null;
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      toast.success(`ID ${id} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-brand-soft font-mono font-bold tracking-wide text-brand",
        size === "xs" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
    >
      <span className="sr-only">ID no Trampo: </span>
      {id}
      {copyable && (
        <button
          type="button"
          onClick={copy}
          className="rounded p-0.5 text-brand/70 transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Copiar ID ${id}`}
          title="Copiar ID"
        >
          <Copy className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}
    </span>
  );
}

/** Avatar + name + secondary line — the standard "who" cell of every table. */
export function UserCell({
  name,
  avatarUrl,
  subtitle,
  publicCode,
  size = "md",
  className,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  subtitle?: React.ReactNode;
  /** In-app ID shown next to the name (copyable). */
  publicCode?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <UserAvatar name={name} src={avatarUrl} size={size} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-semibold text-navy">{name || "Sem nome"}</span>
          {publicCode && <PublicId code={publicCode} size="xs" className="shrink-0" />}
        </div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

export function RatingStars({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
      <b className="tabular-nums text-navy">{value > 0 ? value.toFixed(1).replace(".", ",") : "Novo"}</b>
      {count !== undefined && <span className="text-muted-foreground">({count})</span>}
    </span>
  );
}

/** Five stars, filled up to `value` (review lists). */
export function StarRow({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
      ))}
    </span>
  );
}
