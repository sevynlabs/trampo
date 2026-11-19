"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, HardHat, ShieldCheck, Wallet, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/users", label: "Usuários", icon: Users, exact: false },
  { href: "/professionals", label: "Profissionais", icon: HardHat, exact: false },
  { href: "/finance", label: "Financeiro", icon: Wallet, exact: false },
  { href: "/campaigns", label: "Campanhas", icon: Megaphone, exact: false },
  { href: "/kyc", label: "Verificação (KYC)", icon: ShieldCheck, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-navy text-white md:flex">
      <div className="flex h-20 items-center px-6">
        <Logo tone="dark" size={34} />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "bg-brand text-white shadow-md shadow-brand/30" : "text-white/75 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl bg-white/5 p-4 text-xs text-white/70">
        Painel administrativo
        <div className="font-semibold text-white">Gestão da plataforma</div>
      </div>
    </aside>
  );
}
