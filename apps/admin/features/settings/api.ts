"use client";

import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";

/** Data layer of "Configurações" — the only place that talks to admin.settings.*. */

export type PlatformSettings = RouterOutputs["admin"]["settings"]["get"]["settings"];
export type SettingsUpdate = RouterInputs["admin"]["settings"]["update"];
export type AdminRow = RouterOutputs["admin"]["settings"]["listAdmins"][number];
export type AdminRole = AdminRow["role"];
export type RoleInfo = RouterOutputs["admin"]["settings"]["roles"][number];
export type CreateAdminInput = RouterInputs["admin"]["settings"]["createAdmin"];

export const ADMIN_ROLES: AdminRole[] = ["SUPER_ADMIN", "OPERATOR", "VIEWER"];

/** @deprecated use `useAdminRole()` from "@/hooks/use-admin-role". */
export { useAdminRole as useMe } from "@/hooks/use-admin-role";

export function useSettings() {
  return trpc.admin.settings.get.useQuery();
}

export function useUpdateSettings(successMessage = "Configurações salvas") {
  const utils = trpc.useUtils();
  return trpc.admin.settings.update.useMutation({
    onSuccess: (data) => {
      utils.admin.settings.get.setData(undefined, data);
      toast.success(successMessage);
    },
    onError: (e) => toast.error("Não foi possível salvar", { description: e.message }),
  });
}

export function useAdmins() {
  return trpc.admin.settings.listAdmins.useQuery();
}

export function useRoles() {
  return trpc.admin.settings.roles.useQuery(undefined, { staleTime: Infinity });
}

export function useUpdateAdmin() {
  const utils = trpc.useUtils();
  return trpc.admin.settings.updateAdmin.useMutation({
    onSuccess: async (a, vars) => {
      await utils.admin.settings.listAdmins.invalidate();
      toast.success(
        vars.isActive !== undefined ? (a.isActive ? `${a.name} foi reativado` : `${a.name} foi desativado`) : `Papel de ${a.name} atualizado`
      );
    },
    onError: (e) => toast.error("Não foi possível atualizar o administrador", { description: e.message }),
  });
}

export function useCreateAdmin(onDone?: () => void) {
  const utils = trpc.useUtils();
  return trpc.admin.settings.createAdmin.useMutation({
    onSuccess: async (a) => {
      await utils.admin.settings.listAdmins.invalidate();
      toast.success("Administrador criado", { description: `${a.name} já pode entrar com o e-mail ${a.email}.` });
      onDone?.();
    },
    onError: (e) => toast.error("Não foi possível criar o administrador", { description: e.message }),
  });
}
