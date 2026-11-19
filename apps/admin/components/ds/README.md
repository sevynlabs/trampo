# Trampo Admin — Design System

Tudo que é de página vem de `@/components/ds`; primitivos (Button, Input, Select,
Dialog, Tabs, Switch, Checkbox, RadioGroup, Tooltip, Popover, Sheet, Avatar…) de
`@/components/ui/*` (shadcn/ui sobre Radix).

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `navy` | `#041E42` (+ `navy-50`, `navy-100`, `navy-soft`, `navy-900`) | sidebar, títulos, texto forte, botão `navy` |
| `brand` / `primary` | `#FF6A00` (+ `brand-soft`) | CTA principal, item ativo do menu, série principal dos gráficos |
| `sky` | `#0096D6` (+ `sky-soft`) | apoio: links, status "verificado/informativo", 2ª série |
| fundo | `--background` `#F5F8FC` | área de conteúdo |
| superfícies | `bg-card` branco, `border-border/70`, `shadow-card` (hover `shadow-card-hover`) | cards, tabelas |
| raios | `rounded-xl` (campos, botões), `rounded-2xl` (cards), `rounded-3xl` (login) | |
| tipografia | Inter (UI) · Nunito 800/900 (marca) | `text-2xl font-extrabold text-navy` título de página, `text-base font-bold` título de seção, `text-sm` corpo, `text-xs`/`text-2xs` legendas |
| espaçamento | grid de 4px; `space-y-6` entre blocos da página, `p-5` em cards, `gap-4` em grades de KPI | |

## Estados de interação
- **hover**: botões escurecem/tintam, campos ganham `border-navy/25`, linhas de tabela `bg-muted/40`.
- **focus**: `ring-2 ring-primary/20 + border-primary` em campos; `ring-ring` em botões/links (sempre visível no teclado).
- **active**: botões `scale-[0.98]`; menu ativo em laranja com `shadow-brand`.
- **disabled**: `opacity-50`, sem ponteiro.
- **inválido**: `aria-invalid` deixa a borda vermelha; `<Field error>` mostra a mensagem.

## Botões e campos
`Button` variantes: `default` (laranja, ação principal — 1 por tela), `navy`, `outline`, `soft`, `ghost`, `destructive`, `link`.
Tamanhos: `xs` 28px · `sm` 36px · `default` 40px · `lg` 44px · `icon` / `icon-sm`. Campos e selects têm 40px.

## Status
Toda cor de status sai de `constants/status.ts` (mapas por domínio → `tone`) e é
desenhada por `<StatusBadge map={TASK_STATUS} status={row.status} />`.
Tons: `success` (ativo, pago, concluído) · `info` (verificado, em andamento) ·
`warning` (pendente, aguardando, processando) · `danger` (cancelado, rejeitado,
disputa) · `neutral` (inativo, encerrado) · `brand` / `navy` (destaques).

## Layout
`AppShell` = sidebar escura fixa (≥ lg) / drawer (mobile) + topbar sticky +
conteúdo com `max-w-[1440px]`. O menu vem de `constants/navigation.ts` (um item
lá = rota no menu com estado ativo, hover e contador). O seletor de período da
topbar escreve `?period=` na URL (`usePeriod()`), assim como os filtros das listas
(`useUrlState()`), então filtros sobrevivem a reload e podem ser compartilhados.

Grades: KPIs `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`; gráficos
`grid gap-4 xl:grid-cols-[1.6fr_1fr]`.

## Padrão de página de lista
```tsx
<PageHeader title="Solicitações" description="…" actions={<Button>…</Button>} />
<SectionCard>
  <FilterBar>
    <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Buscar por…" />
    <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={…} />
    <PeriodSelect value={period} onChange={(p) => set({ period: p })} />
  </FilterBar>
  <DataTable columns={columns} data={q.data?.items} loading={q.isLoading}
    error={q.error?.message} onRetry={q.refetch}
    pagination={{ page, pageSize, total, onPageChange: (p) => set({ page: String(p) }, { resetPage: false }) }}
    sorting={{ sortBy, sortDir, onChange: (by, dir) => set({ sortBy: by, sortDir: dir }) }}
    onRowClick={(r) => open(r.id)} />
</SectionCard>
```
Detalhes abrem em `Sheet` (drawer lateral); ações sensíveis passam por `ConfirmDialog`
(com `requireReason` quando há justificativa); feedback com `toast` de `@/components/ui/toaster`.

## Tabela
`DataTable` (TanStack Table): ordenação (`enableSorting: true` na coluna; no modo
servidor o `id` da coluna vira `sortBy`), paginação servidor ou cliente, seleção
opcional (`selectable`), cabeçalho fixo, linhas clicáveis acessíveis (Enter),
estados de carregando / vazio / erro embutidos. Alinhamento por `meta.align`.
Ações de linha: `<RowActions><IconButton icon={Eye} label="Ver" /></RowActions>`.

## Formulários
react-hook-form + zod (`zodResolver`). `FormSection` agrupa, `Field` dá label,
dica e erro, `SettingRow` para preferências com `Switch`. Botão de envio mostra
`Loader2` e fica desabilitado enquanto envia.

## Gráficos
`AreaChart` (linha com gradiente, grade tracejada, tooltip), `DonutChart`
(total no centro + legenda com %), `HBarChart` (ranking). Paleta `CHART_COLORS`:
laranja → azul → navy; status usam verde/âmbar/vermelho. Valores formatados por
quem chama (`formatBRL`, `formatNumber`). Sem dados → estado vazio padronizado.

## Dados
Páginas não chamam `trpc` direto em JSX espalhado: cada domínio tem
`features/<domínio>/api.ts` (hooks que encapsulam as queries/mutations tRPC e
os tipos inferidos) — é o ponto único para trocar/estender a API.
