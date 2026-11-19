"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/campaigns", label: "Campanhas" },
  { href: "/campaigns/templates", label: "Templates de e-mail" },
  { href: "/campaigns/coupons", label: "Cupons" },
];

/** Secondary navigation of the Campanhas area (same look as FinanceNav). */
export function CampaignsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções de campanhas" className="inline-flex h-10 items-center gap-1 rounded-xl bg-muted p-1">
      {TABS.map((t) => {
        // "/campaigns" is active for the list, a campaign detail and /campaigns/new.
        const active =
          t.href === "/campaigns"
            ? !TABS.some((o) => o.href !== "/campaigns" && pathname.startsWith(o.href))
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-navy shadow-sm" : "text-muted-foreground hover:text-navy"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
