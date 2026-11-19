import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CreditCard,
  GalleryHorizontal,
  HardHat,
  LayoutDashboard,
  Megaphone,
  Scale,
  Settings,
  Star,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (used by "/"). */
  exact?: boolean;
  /** Optional query key shown as a counter badge (see Sidebar). */
  badgeKey?: "kycPending" | "openDisputes";
  /** Children for future collapsible groups. */
  children?: NavItem[];
};

export type NavSection = { title?: string; items: NavItem[] };

/**
 * Single source of truth for the sidebar and breadcrumbs.
 * Add a module here and it shows up in the menu with active/hover states.
 */
export const NAVIGATION: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/users", label: "Usuários", icon: Users },
      { href: "/professionals", label: "Profissionais", icon: HardHat },
      { href: "/services", label: "Serviços", icon: Wrench },
      { href: "/requests", label: "Solicitações", icon: CalendarClock },
      { href: "/finance", label: "Pagamentos", icon: CreditCard },
      { href: "/reviews", label: "Avaliações", icon: Star },
      { href: "/disputes", label: "Disputas", icon: Scale, badgeKey: "openDisputes" },
      { href: "/campaigns", label: "Campanhas", icon: Megaphone },
      { href: "/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    title: "Operação",
    items: [
      { href: "/kyc", label: "Verificação", icon: BadgeCheck, badgeKey: "kycPending" },
      { href: "/banners", label: "Anunciantes", icon: GalleryHorizontal },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export const NAV_FLAT: NavItem[] = NAVIGATION.flatMap((s) => s.items);

export function isNavActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Label of the module that owns `pathname` (for breadcrumbs / document titles). */
export function navLabelFor(pathname: string): string | undefined {
  return NAV_FLAT.find((i) => isNavActive(i, pathname))?.label;
}
