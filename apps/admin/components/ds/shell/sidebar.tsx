"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { NAVIGATION, isNavActive, type NavItem } from "@/constants/navigation";
import { trpc } from "@/lib/trpc";

type Counters = Partial<Record<NonNullable<NavItem["badgeKey"]>, number>>;

/** One menu entry: icon, label, active/hover states, optional counter. */
export function SidebarItem({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        active ? "bg-brand text-white shadow-brand" : "text-white/70 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", !active && "text-white/60 group-hover:text-white")} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {!!count && (
        <span
          className={cn(
            "min-w-[20px] rounded-full px-1.5 text-center text-2xs font-bold leading-5",
            active ? "bg-white/25 text-white" : "bg-brand text-white"
          )}
          aria-label={`${count} pendentes`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Navigation content (used by the fixed desktop sidebar and the mobile drawer). */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const stats = trpc.admin.dashboardStats.useQuery(undefined, { staleTime: 60_000 });
  const counters: Counters = { kycPending: stats.data?.kycPending, openDisputes: stats.data?.openDisputes };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 shrink-0 items-center px-6">
        <Link href="/" onClick={onNavigate} aria-label="Ir para o Dashboard">
          <Logo tone="dark" size={30} />
        </Link>
      </div>
      <nav aria-label="Menu principal" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAVIGATION.map((section, i) => (
          <div key={section.title ?? i} className="space-y-1">
            {section.title && (
              <div className="px-3 pb-1 text-2xs font-bold uppercase tracking-wider text-white/40">{section.title}</div>
            )}
            {section.items.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                active={isNavActive(item, pathname)}
                count={item.badgeKey ? counters[item.badgeKey] : undefined}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-xl bg-white/[0.06] p-4 text-xs text-white/60">
        Painel administrativo
        <div className="font-semibold text-white">Trampo · serviços sob demanda</div>
      </div>
    </div>
  );
}

/** Fixed dark sidebar (desktop). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-navy text-white lg:block">
      <SidebarNav />
    </aside>
  );
}
