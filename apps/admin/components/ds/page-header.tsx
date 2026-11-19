import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/** Page title row: optional breadcrumb, title, description and actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: Crumb[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
            {breadcrumb.map((c, i) => (
              <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-navy">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{c.label}</span>
                )}
                {i < breadcrumb.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
