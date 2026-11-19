"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog, DataTable, IconButton, PageHeader, RowActions, SearchInput, SectionCard, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useDeleteTemplate, useTemplates, type EmailTemplate } from "../api";
import { TemplateDialog } from "./template-dialog";

export function TemplatesView() {
  const list = useTemplates();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<EmailTemplate | "new" | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);
  const remove = useDeleteTemplate(() => setDeleting(null));

  const columns = useMemo<ColumnDef<EmailTemplate, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Nome",
        enableSorting: true,
        cell: ({ row: { original: t } }) => <span className="font-semibold text-navy">{t.name}</span>,
      },
      {
        id: "subject",
        header: "Assunto",
        meta: { className: "max-w-[320px]" },
        cell: ({ row: { original: t } }) => <span className="block truncate text-muted-foreground">{t.subject}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row: { original: t } }) =>
          t.isActive ? <StatusBadge tone="success" label="Ativo" /> : <StatusBadge tone="neutral" label="Inativo" />,
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: "Atualizado em",
        enableSorting: true,
        cell: ({ row: { original: t } }) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.updatedAt)}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        meta: { align: "right" },
        cell: ({ row: { original: t } }) => (
          <RowActions>
            <IconButton icon={Pencil} label="Editar template" onClick={() => setEditing(t)} />
            <IconButton icon={Trash2} label="Excluir template" tone="danger" onClick={() => setDeleting(t)} />
          </RowActions>
        ),
      },
    ],
    []
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.data?.filter((t) => !s || t.name.toLowerCase().includes(s) || t.subject.toLowerCase().includes(s));
  }, [list.data, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "Campanhas", href: "/campaigns" }, { label: "Templates" }]}
        title="Templates de e-mail"
        description="Modelos reutilizáveis para campanhas de e-mail."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Novo template
          </Button>
        }
      />

      <SectionCard>
        <div className="space-y-4">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar por nome ou assunto" className="max-w-md" />
          <DataTable
            columns={columns}
            data={rows}
            loading={list.isLoading}
            error={list.error?.message}
            onRetry={() => list.refetch()}
            getRowId={(t) => t.id}
            onRowClick={setEditing}
            rowLabel={(t) => `Template ${t.name}`}
            empty={{
              icon: FileText,
              title: "Nenhum template",
              description: "Crie um modelo para agilizar as campanhas de e-mail.",
            }}
          />
        </div>
      </SectionCard>

      <TemplateDialog template={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir template?"
        description={<>O template “{deleting?.name}” será excluído permanentemente. Campanhas já criadas não são afetadas.</>}
        confirmLabel="Excluir"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </div>
  );
}
