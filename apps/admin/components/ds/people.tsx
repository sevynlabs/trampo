import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
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

/** Avatar + name + secondary line — the standard "who" cell of every table. */
export function UserCell({
  name,
  avatarUrl,
  subtitle,
  size = "md",
  className,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  subtitle?: React.ReactNode;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <UserAvatar name={name} src={avatarUrl} size={size} />
      <div className="min-w-0">
        <div className="truncate font-semibold text-navy">{name || "Sem nome"}</div>
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
