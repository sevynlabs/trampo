# Supabase — banco de produção do Trampo

Projeto `trampo` (`anrlbrsamszjecwrybmh`), região São Paulo (`sa-east-1`), Postgres 17.

## Como o app acessa os dados

- **Tudo passa pela API.** O app e o painel nunca leem tabelas com as chaves
  públicas (anon/authenticated): a API usa a conexão direta (Prisma) e a
  service role (Storage, Realtime).
- **RLS ligado em todas as tabelas** e permissões de leitura/escrita retiradas
  das chaves públicas (`002_revoke_public_api_access.sql`). As políticas de RLS
  ficam como segunda camada de proteção.
- **Realtime do chat:** só um aviso sem conteúdo ("nova mensagem"); o app busca
  a mensagem pela API, que confere quem pode ler.

## Armazenamento (Storage)

| Bucket | Público | Tipos | Uso |
|---|---|---|---|
| `avatars` | sim | JPG, PNG, WebP (5 MB) | fotos de perfil |
| `kyc-documents` | **não** | JPG, PNG, PDF (5 MB) | documentos, selfie e certidão; leitura só por link temporário |

## Onde ficam as mudanças de banco

Dois lugares, cada um com seu papel:

1. **Tabelas, colunas e índices → Prisma** (`packages/db/prisma/schema.prisma`).
   Mudou o schema? Gere a migração e aplique:
   ```bash
   pnpm --filter @trampo/db exec prisma migrate dev --name descricao   # banco de desenvolvimento
   pnpm db:migrate:deploy                                              # produção
   ```
   Migrações já aplicadas em produção: `0_init` (base) e `20261119200000_fk_indexes`.
2. **Segurança e configurações do Supabase → SQL** (`supabase/migrations/`):
   RLS, permissões, buckets. Numeradas em ordem (001 a 007) e idempotentes.

Regra para não derrubar apps já publicados: coluna nova entra **opcional**; só
vira obrigatória depois que todos os apps em uso mandam o valor. Nunca apagar
ou renomear coluna que uma versão publicada ainda usa.

## Conferências

```bash
pnpm --filter @trampo/db migrate:status        # migrações em dia?
```
No painel do Supabase: Advisors → Security / Performance. Estado em 19/11/2026:
nenhum alerta de segurança; só avisos informativos (tabelas internas sem política,
que é proposital, e índices ainda sem uso por falta de tráfego).

## Antes do lançamento (decisões do dono)

- **Plano Pro (US$ 25/mês):** o plano gratuito pausa o projeto após dias sem uso
  e não oferece backups diários para restaurar. Para produção, Pro.
- **Auth do Supabase:** o app usa login próprio (SMS + JWT da API). Em
  Authentication → Sign In / Providers, desligar "Allow new users to sign up".
- **Banco de desenvolvimento separado:** um segundo projeto (gratuito) para
  testes, para que desenvolvimento nunca escreva em dados de clientes.
- **Limpeza:** remover as contas de teste antes de abrir ao público.
