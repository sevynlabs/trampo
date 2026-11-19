import {
  Baby,
  Bug,
  Car,
  Droplets,
  Hammer,
  Home,
  Laptop,
  Leaf,
  Package,
  Paintbrush,
  Palette,
  PawPrint,
  Scissors,
  Shirt,
  Snowflake,
  Sparkles,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The mobile app stores Ionicons names (e.g. "flash-outline"). The panel
 * doesn't ship Ionicons, so the most common ones map to a close lucide icon;
 * unknown names fall back to the service initials.
 */
const IONICON_TO_LUCIDE: Record<string, LucideIcon> = {
  flash: Zap,
  bulb: Zap,
  water: Droplets,
  brush: Paintbrush,
  "color-palette": Palette,
  "color-fill": Paintbrush,
  hammer: Hammer,
  construct: Wrench,
  build: Wrench,
  settings: Wrench,
  leaf: Leaf,
  flower: Leaf,
  sparkles: Sparkles,
  home: Home,
  car: Car,
  "car-sport": Car,
  bus: Truck,
  cube: Package,
  "file-tray": Package,
  paw: PawPrint,
  laptop: Laptop,
  desktop: Laptop,
  "phone-portrait": Laptop,
  cut: Scissors,
  shirt: Shirt,
  snow: Snowflake,
  bug: Bug,
  happy: Baby,
};

export function resolveServiceIcon(icon?: string | null): LucideIcon | null {
  if (!icon) return null;
  const base = icon.replace(/-(outline|sharp)$/, "");
  return IONICON_TO_LUCIDE[base] ?? null;
}

export function ServiceIcon({
  icon,
  name,
  className,
  muted,
}: {
  icon?: string | null;
  name: string;
  className?: string;
  muted?: boolean;
}) {
  const Icon = resolveServiceIcon(icon);
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        muted ? "bg-muted text-muted-foreground" : "bg-brand-soft text-brand",
        className
      )}
      aria-hidden
    >
      {Icon ? (
        <Icon className="h-5 w-5" />
      ) : (
        <span className="text-xs font-extrabold uppercase">{name.slice(0, 2)}</span>
      )}
    </span>
  );
}
