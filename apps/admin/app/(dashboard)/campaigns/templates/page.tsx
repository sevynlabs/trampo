"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

type Editing = {
  id?: string;
  name: string;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
};

const EMPTY: Editing = { name: "", subject: "", bodyHtml: "", isActive: true };

export default function TemplatesPage() {
  const utils = trpc.useUtils();
  const query = trpc.admin.campaigns.listTemplates.useQuery();
  const [editing, setEditing] = useState<Editing | null>(null);

  const invalidate = () => utils.admin.campaigns.listTemplates.invalidate();
  const create = trpc.admin.campaigns.createTemplate.useMutation({
    onSuccess: () => { invalidate(); setEditing(null); },
  });
  const update = trpc.admin.campaigns.updateTemplate.useMutation({
    onSuccess: () => { invalidate(); setEditing(null); },
  });
  const remove = trpc.admin.campaigns.deleteTemplate.useMutation({
    onSuccess: invalidate,
  });

  const saving = create.isPending || update.isPending;
  const valid =
    (editing?.name.trim().length ?? 0) >= 2 &&
    (editing?.subject.trim().length ?? 0) >= 2 &&
    (editing?.bodyHtml.trim().length ?? 0) >= 2;

  function save() {
    if (!editing) return;
    if (editing.id) {
      update.mutate({
        id: editing.id,
        name: editing.name.trim(),
        subject: editing.subject.trim(),
        bodyHtml: editing.bodyHtml.trim(),
        isActive: editing.isActive,
      });
    } else {
      create.mutate({
        name: editing.name.trim(),
        subject: editing.subject.trim(),
        bodyHtml: editing.bodyHtml.trim(),
      });
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar às campanhas
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates de email</h1>
          <p className="text-muted-foreground">
            Modelos reutilizáveis. Use <code>{"{{name}}"}</code> para o nome do usuário.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="mr-2 h-4 w-4" /> Novo template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {query.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum template ainda.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {t.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "success" : "secondary"}>
                      {t.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(t.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing({
                            id: t.id,
                            name: t.name,
                            subject: t.subject,
                            bodyHtml: t.bodyHtml,
                            isActive: t.isActive,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Excluir o template "${t.name}"?`)) {
                            remove.mutate({ id: t.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="t-name">Nome</Label>
                  <Input
                    id="t-name"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-subject">Assunto</Label>
                  <Input
                    id="t-subject"
                    value={editing.subject}
                    onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-body">Corpo (HTML)</Label>
                <Textarea
                  id="t-body"
                  rows={8}
                  value={editing.bodyHtml}
                  onChange={(e) => setEditing({ ...editing, bodyHtml: e.target.value })}
                  placeholder="<h1>Olá {{name}}</h1>"
                />
              </div>
              {editing.id && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={(e) =>
                      setEditing({ ...editing, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  Ativo
                </label>
              )}
              {(create.isError || update.isError) && (
                <p className="text-sm text-destructive">
                  {create.error?.message ?? update.error?.message}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button disabled={!valid || saving} onClick={save}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
