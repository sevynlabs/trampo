import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";

/**
 * Users data hooks — the single point where the Usuários pages touch the API.
 * Mutations invalidate every list/detail that shows the user and toast the result.
 */

export type UsersListInput = RouterInputs["admin"]["listUsers"];
export type UsersList = RouterOutputs["admin"]["listUsers"];
export type UserRow = UsersList["users"][number];
export type UserDetail = RouterOutputs["admin"]["getUser"];
export type UserRole = "CLIENT" | "TASKER" | "BOTH";
export type UserSortBy = NonNullable<UsersListInput["sortBy"]>;
export const USER_SORT_KEYS: readonly UserSortBy[] = ["createdAt", "name"];

export function useUsersList(params: UsersListInput) {
  return trpc.admin.listUsers.useQuery(params, { placeholderData: keepPreviousData });
}

/** Counts for the quick tabs (Todos · Clientes · Profissionais · Ambos) and identity filter. */
export function useUserCounts() {
  return trpc.admin.userCounts.useQuery(undefined, { staleTime: 30_000 });
}

export function useUser(id: string | null | undefined) {
  return trpc.admin.getUser.useQuery({ id: id ?? "" }, { enabled: !!id });
}

/** Invalidate everything that lists or shows users/professionals. */
function useInvalidateUsers() {
  const utils = trpc.useUtils();
  return (id?: string) =>
    Promise.all([
      utils.admin.listUsers.invalidate(),
      utils.admin.listProfessionals.invalidate(),
      id ? utils.admin.getUser.invalidate({ id }) : utils.admin.getUser.invalidate(),
      utils.admin.dashboardStats.invalidate(),
    ]);
}

/** Block / unblock (isActive). Pass `silent` to skip the toast (bulk actions toast once). */
export function useSetUserActive(opts: { silent?: boolean } = {}) {
  const invalidate = useInvalidateUsers();
  return trpc.admin.setUserActive.useMutation({
    onSuccess: (res, vars) => {
      invalidate(vars.id);
      if (!opts.silent) toast.success(res.isActive ? "Usuário desbloqueado" : "Usuário bloqueado");
    },
    onError: (err) => {
      if (!opts.silent) toast.error(err.message || "Não foi possível alterar o status");
    },
  });
}

export function useSetUserRole() {
  const invalidate = useInvalidateUsers();
  return trpc.admin.setUserRole.useMutation({
    onSuccess: (_res, vars) => {
      invalidate(vars.id);
      toast.success("Tipo de conta atualizado");
    },
    onError: (err) => toast.error(err.message || "Não foi possível alterar o tipo de conta"),
  });
}
