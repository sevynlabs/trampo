"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Settings, ShieldCheck, Scale, Wallet } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ADMIN_ROLE_LABEL } from "@/constants/status";
import { navLabelFor } from "@/constants/navigation";
import { usePeriod } from "@/hooks/use-url-state";
import { PeriodSelect } from "../filters";
import { UserAvatar } from "../people";
import { SidebarNav } from "./sidebar";

/** Routes whose data follows the global period selector. */
const PERIOD_ROUTES = ["/", "/reports"];

function Notifications() {
  const overview = trpc.admin.dashboard.overview.useQuery(undefined, { staleTime: 60_000 });
  const stats = trpc.admin.dashboardStats.useQuery(undefined, { staleTime: 60_000 });
  const items = [
    { icon: ShieldCheck, label: "Verificações aguardando análise", count: stats.data?.kycPending ?? 0, href: "/kyc" },
    { icon: Scale, label: "Disputas abertas", count: overview.data?.openDisputes ?? 0, href: "/disputes" },
    { icon: Wallet, label: "Saques pendentes", count: overview.data?.pendingWithdrawals ?? 0, href: "/finance/withdrawals" },
  ].filter((i) => i.count > 0);
  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações (${total})`}>
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="px-2 pb-2 pt-1 text-sm font-bold text-navy">Pendências</div>
        {items.length === 0 ? (
          <p className="px-2 pb-3 text-sm text-muted-foreground">Tudo em dia. Nenhuma pendência agora. 🎉</p>
        ) : (
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <i.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-foreground">{i.label}</span>
                  <b className="tabular-nums text-navy">{i.count}</b>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AdminMenu() {
  const router = useRouter();
  const me = trpc.admin.me.useQuery();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (me.isLoading) return <Skeleton className="h-9 w-40 rounded-xl" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar name={me.data?.name} size="sm" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-bold text-navy">{me.data?.name ?? "Admin"}</span>
            <span className="block text-2xs text-muted-foreground">{ADMIN_ROLE_LABEL[me.data?.role ?? ""] ?? me.data?.role}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-semibold">{me.data?.name}</div>
          <div className="truncate text-xs text-muted-foreground">{me.data?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" /> Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout} className="text-rose-600 focus:text-rose-700">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const [period, setPeriod] = usePeriod();
  const [menuOpen, setMenuOpen] = useState(false);
  const showPeriod = PERIOD_ROUTES.includes(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-card/90 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </Button>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] border-0 bg-navy p-0 text-white sm:max-w-[18rem]">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground lg:hidden">{navLabelFor(pathname)}</div>
      <div className="hidden flex-1 lg:block" />

      {showPeriod && <PeriodSelect value={period} onChange={setPeriod} className="hidden w-[190px] sm:block" />}
      <Notifications />
      <AdminMenu />
    </header>
  );
}
