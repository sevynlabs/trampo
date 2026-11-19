"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/components/ui/toaster";

/** Data layer of "Campanhas" — the only place that talks to admin.campaigns.*. */

export type CampaignRow = RouterOutputs["admin"]["campaigns"]["list"][number];
export type CampaignDetail = RouterOutputs["admin"]["campaigns"]["get"];
export type CampaignCreateInput = RouterInputs["admin"]["campaigns"]["create"];
export type CampaignChannel = CampaignCreateInput["channel"];
export type Segment = CampaignCreateInput["segment"];
export type EmailTemplate = RouterOutputs["admin"]["campaigns"]["listTemplates"][number];
export type TemplateInput = RouterInputs["admin"]["campaigns"]["createTemplate"];

export const CHANNEL_LABEL: Record<CampaignChannel, string> = { PUSH: "Push", EMAIL: "E-mail" };

export function useCampaigns() {
  return trpc.admin.campaigns.list.useQuery();
}

export function useCampaign(id: string) {
  return trpc.admin.campaigns.get.useQuery({ id });
}

export function useEmailStatus() {
  return trpc.admin.campaigns.emailStatus.useQuery();
}

export function useSegmentPreview(channel: CampaignChannel, segment: Segment | null) {
  return trpc.admin.campaigns.previewSegment.useQuery(
    { channel, segment: segment ?? { role: "ALL", kycStatus: "ANY", onlyActive: true } },
    { enabled: !!segment, placeholderData: keepPreviousData }
  );
}

export function useCreateCampaign(onCreated?: (id: string) => void) {
  const utils = trpc.useUtils();
  return trpc.admin.campaigns.create.useMutation({
    onSuccess: async ({ id }) => {
      await utils.admin.campaigns.list.invalidate();
      toast.success("Rascunho criado", { description: "Revise a campanha e envie quando estiver pronta." });
      onCreated?.(id);
    },
    onError: (e) => toast.error("Não foi possível criar a campanha", { description: e.message }),
  });
}

export function useSendCampaign(id: string, onDone?: () => void) {
  const utils = trpc.useUtils();
  return trpc.admin.campaigns.send.useMutation({
    onSuccess: async (r) => {
      await Promise.all([utils.admin.campaigns.get.invalidate({ id }), utils.admin.campaigns.list.invalidate()]);
      toast.success("Campanha enviada", {
        description: `${r.sentCount} de ${r.recipientCount} entregues${r.failedCount ? ` · ${r.failedCount} falhas` : ""}.`,
      });
      onDone?.();
    },
    onError: (e) => toast.error("Falha ao enviar a campanha", { description: e.message }),
  });
}

// ---- Templates ---------------------------------------------------------------

export function useTemplates(enabled = true) {
  return trpc.admin.campaigns.listTemplates.useQuery(undefined, { enabled });
}

export function useSaveTemplate(onDone?: () => void) {
  const utils = trpc.useUtils();
  const opts = (verb: string) => ({
    onSuccess: async () => {
      await utils.admin.campaigns.listTemplates.invalidate();
      toast.success(`Template ${verb}`);
      onDone?.();
    },
    onError: (e: { message: string }) => toast.error("Não foi possível salvar o template", { description: e.message }),
  });
  const create = trpc.admin.campaigns.createTemplate.useMutation(opts("criado"));
  const update = trpc.admin.campaigns.updateTemplate.useMutation(opts("atualizado"));
  return { create, update, isPending: create.isPending || update.isPending };
}

export function useDeleteTemplate(onDone?: () => void) {
  const utils = trpc.useUtils();
  return trpc.admin.campaigns.deleteTemplate.useMutation({
    onSuccess: async () => {
      await utils.admin.campaigns.listTemplates.invalidate();
      toast.success("Template excluído");
      onDone?.();
    },
    onError: (e) => toast.error("Não foi possível excluir o template", { description: e.message }),
  });
}
