"use client";

import { trpc, type RouterOutputs } from "@/lib/trpc";

export type AdminMe = RouterOutputs["admin"]["me"];
export type AdminRoleName = "SUPER_ADMIN" | "OPERATOR" | "VIEWER";

/** Tooltip shown on actions a VIEWER can't use. */
export const READ_ONLY_HINT = "Seu perfil é somente leitura";

/**
 * Current admin's role and what it can do. Shares the `admin.me` cache with the
 * Topbar (5 min staleTime), so calling it in many components costs one request.
 * The API enforces permissions anyway — this only adapts the UI.
 * While loading, `canEdit` is false (actions render disabled, never flash enabled).
 */
export function useAdminRole() {
  const q = trpc.admin.me.useQuery(undefined, { staleTime: 5 * 60_000 });
  const role = (q.data?.role ?? null) as AdminRoleName | null;
  const canEdit = role === "SUPER_ADMIN" || role === "OPERATOR";
  return {
    role,
    me: q.data,
    isLoading: q.isLoading,
    canEdit,
    isSuperAdmin: role === "SUPER_ADMIN",
    isViewer: role === "VIEWER",
    /** Pass to `IconButton disabledReason` / `<DisabledHint hint>`: undefined when allowed. */
    readOnlyReason: canEdit ? undefined : READ_ONLY_HINT,
  };
}
