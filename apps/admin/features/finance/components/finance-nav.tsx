"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/finance", label: "Pagamentos" },
  { href: "/finance/withdrawals", label: "Saques" },
];

/** Secondary navigation between Pagamentos and Saques (looks like Tabs). */
export function FinanceNav({ pendingWithdrawals }: { pendingWithdrawals?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções de pagamentos" className="inline-flex h-10 items-center gap-1 rounded-xl bg-muted p-1">
      {TABS.map((t) => {
        const active = t.href === "/finance" ? pathname === "/finance" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-navy shadow-sm" : "text-muted-foreground hover:text-navy"
            )}
          >
            {t.label}
            {t.href === "/finance/withdrawals" && !!pendingWithdrawals && (
              <span className="rounded-full bg-brand px-1.5 text-2xs font-bold tabular-nums text-white">
                {pendingWithdrawals}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
