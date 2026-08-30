"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATOR: "Operador",
  VIEWER: "Visualizador",
};

export function Header() {
  const router = useRouter();
  const me = trpc.admin.me.useQuery();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div />
      <div className="flex items-center gap-4">
        {me.isLoading ? (
          <Skeleton className="h-5 w-32" />
        ) : me.data ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{me.data.name}</span>
            <Badge variant="secondary">
              {ROLE_LABELS[me.data.role] ?? me.data.role}
            </Badge>
          </div>
        ) : null}
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
