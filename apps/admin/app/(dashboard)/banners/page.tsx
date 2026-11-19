"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink, ImageOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";

type Editing = {
  id?: string;
  advertiser: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  sortOrder: number;
  startsAt: string; // yyyy-mm-dd (local)
  endsAt: string;
  isActive: boolean;
};

const EMPTY: Editing = {
  advertiser: "",
  title: "",
  imageUrl: "",
  linkUrl: "",
  sortOrder: 0,
  startsAt: "",
  endsAt: "",
  isActive: true,
};

/** yyyy-mm-dd (date input) → ISO at the start/end of that local day. */
function toIso(day: string, endOfDay: boolean): string | null {
  if (!day) return null;
  const d = new Date(`${day}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
const toDay = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());

function status(b: { isActive: boolean; startsAt: string | null; endsAt: string | null }) {
  const now = Date.now();
  if (!b.isActive) return { label: "Pausado", variant: "secondary" as const };
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return { label: "Agendado", variant: "warning" as const };
  if (b.endsAt && new Date(b.endsAt).getTime() < now) return { label: "Encerrado", variant: "outline" as const };
  return { label: "No ar", variant: "success" as const };
}

export default function BannersPage() {
  const utils = trpc.useUtils();
  const query = trpc.admin.banners.list.useQuery();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [imgError, setImgError] = useState(false);

  const invalidate = () => utils.admin.banners.list.invalidate();
  const create = trpc.admin.banners.create.useMutation({ onSuccess: () => { invalidate(); setEditing(null); } });
  const update = trpc.admin.banners.update.useMutation({ onSuccess: () => { invalidate(); setEditing(null); } });
  const toggle = trpc.admin.banners.toggle.useMutation({ onSuccess: invalidate });
  const remove = trpc.admin.banners.remove.useMutation({ onSuccess: invalidate });

  const saving = create.isPending || update.isPending;
  const valid =
    !!editing &&
    editing.advertiser.trim().length >= 2 &&
    editing.title.trim().length >= 2 &&
    isUrl(editing.imageUrl) &&
    (!editing.linkUrl.trim() || isUrl(editing.linkUrl));

  function open(e: Editing) {
    setImgError(false);
    setEditing(e);
  }

  function save() {
    if (!editing || !valid) return;
    const payload = {
      advertiser: editing.advertiser.trim(),
      title: editing.title.trim(),
      imageUrl: editing.imageUrl.trim(),
      linkUrl: editing.linkUrl.trim() || null,
      sortOrder: editing.sortOrder,
      startsAt: toIso(editing.startsAt, false),
      endsAt: toIso(editing.endsAt, true),
      isActive: editing.isActive,
    };
    if (editing.id) update.mutate({ id: editing.id, ...payload });
    else create.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anunciantes</h1>
          <p className="text-muted-foreground">
            Banners do carrossel no topo do app. Imagem horizontal na proporção 2,4:1 (ex.: 1200×500).
          </p>
        </div>
        <Button onClick={() => open({ ...EMPTY })}>
          <Plus className="mr-2 h-4 w-4" /> Novo banner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Banners</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banner</TableHead>
                <TableHead>Anunciante</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Exibições</TableHead>
                <TableHead className="text-right">Cliques (CTR)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {query.isError && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-destructive">
                    {query.error.message}
                  </TableCell>
                </TableRow>
              )}
              {query.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhum banner ainda. Enquanto não houver, o app mostra o espaço &quot;Sua marca aqui&quot;.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((b) => {
                const st = status(b);
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.imageUrl} alt="" className="h-10 w-24 rounded-md object-cover bg-muted" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{b.title}</p>
                          <p className="text-xs text-muted-foreground">Ordem {b.sortOrder}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{b.advertiser}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.startsAt || b.endsAt ? `${b.startsAt ? formatDate(b.startsAt) : "—"} → ${b.endsAt ? formatDate(b.endsAt) : "—"}` : "Sem prazo"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(b.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(b.clicks)}{" "}
                      <span className="text-muted-foreground">({formatPercent(b.impressions ? b.clicks / b.impressions : 0)})</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ id: b.id, isActive: !b.isActive })}
                        >
                          {b.isActive ? "Pausar" : "Ativar"}
                        </Button>
                        {b.linkUrl && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={b.linkUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir link">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Editar"
                          onClick={() =>
                            open({
                              id: b.id,
                              advertiser: b.advertiser,
                              title: b.title,
                              imageUrl: b.imageUrl,
                              linkUrl: b.linkUrl ?? "",
                              sortOrder: b.sortOrder,
                              startsAt: toDay(b.startsAt),
                              endsAt: toDay(b.endsAt),
                              isActive: b.isActive,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Excluir"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`Excluir o banner "${b.title}" de ${b.advertiser}?`)) remove.mutate({ id: b.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar banner" : "Novo banner"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-muted" style={{ aspectRatio: "2.4 / 1" }}>
                {isUrl(editing.imageUrl) && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.imageUrl} alt="Prévia do banner" className="h-full w-full object-cover" onError={() => setImgError(true)} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    {imgError ? "Não foi possível carregar a imagem" : "Prévia aparece aqui"}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="b-adv">Anunciante</Label>
                  <Input id="b-adv" value={editing.advertiser} onChange={(e) => setEditing({ ...editing, advertiser: e.target.value })} placeholder="Ex.: Casa das Ferramentas" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-title">Título (interno e acessibilidade)</Label>
                  <Input id="b-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ex.: 20% off em furadeiras" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-img">URL da imagem</Label>
                <Input
                  id="b-img"
                  value={editing.imageUrl}
                  onChange={(e) => { setImgError(false); setEditing({ ...editing, imageUrl: e.target.value }); }}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-link">Link ao tocar (opcional)</Label>
                <Input id="b-link" value={editing.linkUrl} onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value })} placeholder="https://site-do-anunciante.com.br" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="b-start">Início</Label>
                  <Input id="b-start" type="date" value={editing.startsAt} onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-end">Fim</Label>
                  <Input id="b-end" type="date" value={editing.endsAt} onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-order">Ordem</Label>
                  <Input
                    id="b-order"
                    type="number"
                    min={0}
                    value={editing.sortOrder}
                    onChange={(e) => setEditing({ ...editing, sortOrder: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                Ativo (aparece no app dentro do período)
              </label>
              {(create.isError || update.isError) && (
                <p className="text-sm text-destructive">{create.error?.message ?? update.error?.message}</p>
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
