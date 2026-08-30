"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Bell, Mail, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Channel = "PUSH" | "EMAIL";

export default function NewCampaignPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("PUSH");
  const [role, setRole] = useState("ALL");
  const [kycStatus, setKycStatus] = useState("ANY");
  const [activeDays, setActiveDays] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const segment = useMemo(
    () => ({
      role: role as never,
      kycStatus: kycStatus as never,
      onlyActive,
      ...(activeDays ? { activeWithinDays: Number(activeDays) } : {}),
    }),
    [role, kycStatus, onlyActive, activeDays]
  );

  const preview = trpc.admin.campaigns.previewSegment.useQuery(
    { channel, segment },
    { placeholderData: keepPreviousData }
  );
  const templates = trpc.admin.campaigns.listTemplates.useQuery(undefined, {
    enabled: channel === "EMAIL",
  });

  const create = trpc.admin.campaigns.create.useMutation({
    onSuccess: ({ id }) => {
      utils.admin.campaigns.list.invalidate();
      router.push(`/campaigns/${id}`);
    },
  });

  const canSubmit =
    name.trim().length >= 2 && title.trim().length >= 2 && body.trim().length >= 2;

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar às campanhas
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova campanha</h1>
        <p className="text-muted-foreground">
          Defina o público, escreva a mensagem e crie o rascunho.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Basics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Canal e nome</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["PUSH", "EMAIL"] as Channel[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors",
                      channel === c
                        ? "border-primary bg-primary/5 text-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {c === "PUSH" ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {c === "PUSH" ? "Push" : "Email"}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome interno</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Reativação de clientes inativos"
                />
              </div>
            </CardContent>
          </Card>

          {/* Segment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Público-alvo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de usuário</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="CLIENT">Clientes</SelectItem>
                    <SelectItem value="TASKER">Profissionais</SelectItem>
                    <SelectItem value="BOTH">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status KYC</Label>
                <Select value={kycStatus} onValueChange={setKycStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Qualquer</SelectItem>
                    <SelectItem value="APPROVED">Aprovado</SelectItem>
                    <SelectItem value="SUBMITTED">Em análise</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="REJECTED">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="days">Cadastrados nos últimos (dias)</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  value={activeDays}
                  onChange={(e) => setActiveDays(e.target.value)}
                  placeholder="Deixe vazio para todos"
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Somente usuários ativos
              </label>
            </CardContent>
          </Card>

          {/* Message */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Mensagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {channel === "EMAIL" && (templates.data?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <Label>Usar template (opcional)</Label>
                  <Select
                    onValueChange={(id) => {
                      const t = templates.data?.find((x) => x.id === id);
                      if (t) {
                        setTitle(t.subject);
                        setBody(t.bodyHtml);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.data?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  {channel === "PUSH" ? "Título do push" : "Assunto do email"}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Olá {{name}}!"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">
                  {channel === "PUSH" ? "Mensagem" : "Corpo (HTML)"}
                </Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={channel === "PUSH" ? 3 : 8}
                  placeholder={
                    channel === "PUSH"
                      ? "Sua próxima oportunidade te espera, {{name}}."
                      : "<h1>Olá {{name}}</h1><p>...</p>"
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use <code>{"{{name}}"}</code> para inserir o nome do usuário.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Live preview / summary */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base">Público estimado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-3xl font-bold tabular-nums">
                    {preview.data?.count ?? "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    destinatários alcançáveis
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {preview.data?.description}
              </p>
              {preview.data && preview.data.count === 0 && (
                <p className="text-xs text-warning">
                  Nenhum usuário alcançável neste canal (
                  {channel === "PUSH" ? "sem push token" : "sem email"}).
                </p>
              )}
              {preview.data?.sample && preview.data.sample.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Amostra
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {preview.data.sample.map((s) => (
                      <li key={s.id} className="truncate">
                        {s.name ?? "—"}
                        {channel === "EMAIL" && s.email ? ` · ${s.email}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {create.isError && (
                <p className="text-xs text-destructive">{create.error.message}</p>
              )}
              <Button
                className="w-full"
                disabled={!canSubmit || create.isPending}
                onClick={() =>
                  create.mutate({
                    name: name.trim(),
                    channel,
                    segment,
                    title: title.trim(),
                    body: body.trim(),
                  })
                }
              >
                Criar rascunho
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Você revisa e envia na próxima tela.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
