"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";

/**
 * Serviços (= categorias de serviço da plataforma). Single point of contact
 * with `admin.services.*` — pages/components only use these hooks.
 */
export type ServiceRow = RouterOutputs["admin"]["services"]["list"][number];
export type ServiceListInput = Exclude<RouterInputs["admin"]["services"]["list"], void | undefined>;
export type ServiceCreateInput = RouterInputs["admin"]["services"]["create"];
export type ServiceUpdateInput = RouterInputs["admin"]["services"]["update"];

export function useServices(input: ServiceListInput) {
  return trpc.admin.services.list.useQuery(input, { placeholderData: keepPreviousData });
}

function useInvalidateServices() {
  const utils = trpc.useUtils();
  return () => utils.admin.services.list.invalidate();
}

export function useCreateService(opts?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateServices();
  return trpc.admin.services.create.useMutation({
    onSuccess: () => {
      toast.success("Serviço criado");
      invalidate();
      opts?.onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Não foi possível criar o serviço"),
  });
}

export function useUpdateService(opts?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateServices();
  return trpc.admin.services.update.useMutation({
    onSuccess: () => {
      toast.success("Serviço atualizado");
      invalidate();
      opts?.onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Não foi possível salvar o serviço"),
  });
}

export function useToggleService() {
  const invalidate = useInvalidateServices();
  return trpc.admin.services.toggle.useMutation({
    onSuccess: (r) => {
      toast.success(r.isActive ? "Serviço ativado" : "Serviço desativado");
      invalidate();
    },
    onError: (e) => toast.error(e.message || "Não foi possível alterar o status"),
  });
}

export function useRemoveService(opts?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateServices();
  return trpc.admin.services.remove.useMutation({
    onSuccess: () => {
      toast.success("Serviço excluído");
      invalidate();
      opts?.onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Não foi possível excluir o serviço"),
  });
}
