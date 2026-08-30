# Saques Automáticos via Pix

**Data:** 2026-07-01
**Status:** Aprovado
**Escopo:** Integração Asaas para transferências Pix instantâneas

---

## Resumo

Implementar saques automáticos para taskers via Pix. Quando o tasker solicita um saque, o sistema transfere imediatamente para a chave Pix cadastrada. Se falhar, o saldo é reembolsado automaticamente.

## Decisões de Negócio

| Decisão | Escolha |
|---------|---------|
| Timing | Imediato (síncrono) |
| Taxa para tasker | Nenhuma (TRAMPO absorve custo Asaas) |
| Tratamento de erro | Reembolsa saldo, tasker pode tentar novamente |
| Valor mínimo | R$ 10,00 |

---

## Arquitetura

```
Tasker solicita saque (mobile)
         ↓
    tRPC: payments.requestWithdrawal
         ↓
    Validações:
    - Saldo disponível >= valor
    - Valor >= R$ 10 (mínimo)
    - Chave Pix cadastrada
         ↓
    Debita saldo (optimistic lock)
         ↓
    Chama Asaas: POST /v3/transfers
    (Pix para chave do tasker)
         ↓
    ┌─────────────────────────────────┐
    │  Sucesso?                       │
    │  ✓ Sim → status = COMPLETED     │
    │  ✗ Não → reembolsa saldo,       │
    │          status = FAILED        │
    └─────────────────────────────────┘
         ↓
    Notifica tasker (push)
```

**Pontos chave:**
- Debita saldo ANTES de chamar Asaas (evita saque duplo)
- Se Asaas falhar, reembolsa atomicamente
- Notificação push confirma resultado

---

## Integração Asaas

### Endpoint

```
POST /v3/transfers
Authorization: Bearer $ASAAS_API_KEY
Content-Type: application/json

{
  "value": 150.00,
  "pixAddressKey": "email@exemplo.com",
  "pixAddressKeyType": "EMAIL",
  "description": "TRAMPO - Saque #abc123"
}
```

### Tipos de chave Pix

| Tipo | pixAddressKeyType |
|------|-------------------|
| CPF | CPF |
| CNPJ | CNPJ |
| Email | EMAIL |
| Telefone | PHONE |
| Chave aleatória | EVP |

### Resposta de sucesso

```json
{
  "id": "transfer_abc123",
  "status": "DONE",
  "value": 150.00,
  "pixAddressKey": "email@exemplo.com"
}
```

### Possíveis erros

| Código | Significado | Ação |
|--------|-------------|------|
| `INSUFFICIENT_BALANCE` | Saldo Asaas da plataforma insuficiente | Reembolsa, notifica admin |
| `INVALID_PIX_KEY` | Chave Pix do tasker inválida | Reembolsa, pede para corrigir chave |
| `DAILY_LIMIT_EXCEEDED` | Limite diário do Asaas | Reembolsa, tentar amanhã |
| Timeout (> 10s) | Problema de rede | Reembolsa, tentar novamente |

---

## Mudanças no Banco de Dados

### Schema Prisma

Adicionar campos ao modelo `Withdrawal`:

```prisma
model Withdrawal {
  id        String   @id @default(cuid())
  userId    String
  value     Int      // centavos
  pixKey    String
  status    WithdrawalStatus @default(PENDING)
  createdAt DateTime @default(now())

  // Novos campos
  asaasTransferId  String?   // ID da transferência no Asaas
  failureReason    String?   // Motivo do erro (ex: "INVALID_PIX_KEY")
  processedAt      DateTime? // Quando foi processado

  user User @relation(fields: [userId], references: [id])
}

enum WithdrawalStatus {
  PENDING
  COMPLETED
  FAILED
}
```

### Migração

```sql
ALTER TABLE "Withdrawal" ADD COLUMN "asaasTransferId" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "processedAt" TIMESTAMP(3);
```

---

## Mudanças no Backend

### Novo arquivo: `apps/api/src/integrations/asaas.ts`

Adicionar método:

```typescript
interface PixTransferRequest {
  value: number;           // em reais (decimal)
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  description: string;
}

interface PixTransferResponse {
  success: boolean;
  transferId?: string;
  error?: string;
  errorCode?: string;
}

export async function createPixTransfer(
  request: PixTransferRequest
): Promise<PixTransferResponse>
```

### Atualizar: `apps/api/src/modules/payments/router.ts`

Método `requestWithdrawal`:

1. Validar saldo disponível >= valor
2. Validar valor >= 1000 (R$ 10 em centavos)
3. Validar chave Pix existe no perfil
4. Adquirir lock Redis por usuário (30s TTL)
5. Debitar saldo em transação
6. Chamar `createPixTransfer`
7. Se sucesso: marcar COMPLETED, salvar `asaasTransferId`
8. Se falha: reembolsar saldo, marcar FAILED, salvar `failureReason`
9. Liberar lock
10. Enviar push notification

---

## Mudanças no Mobile

### Tela de saque (`apps/mobile/app/withdraw.tsx`)

**Estado atual:**
- Campo de valor
- Botão "Solicitar saque"
- Feedback básico

**Melhorias:**

1. **Loading state** durante processamento (2-5s)
2. **Tela de sucesso** com:
   - Animação de check verde
   - Valor transferido
   - Chave Pix destino (mascarada: `****@email.com`)
   - ID da transação (últimos 8 caracteres)
   - Botão "Voltar para início"
3. **Tela de erro** com:
   - Mensagem amigável baseada no `failureReason`
   - Botões de ação contextual:
     - "Corrigir chave Pix" se INVALID_PIX_KEY
     - "Tentar novamente" para erros temporários

### Fluxo visual

```
[Tela Saque]          [Loading]           [Sucesso]
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│ Saldo: R$500 │     │              │    │     ✓        │
│              │     │   ◌ ◌ ◌     │    │ Pix Enviado! │
│ Valor: _____ │ --> │  Enviando   │ -->│              │
│              │     │    Pix...   │    │  R$ 150,00   │
│ [Sacar]      │     │              │    │  ****@email  │
└──────────────┘     └──────────────┘    └──────────────┘
```

---

## Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| Saldo insuficiente | Bloqueia antes de chamar Asaas, mostra erro |
| Valor < R$ 10 | Validação frontend + backend |
| Sem chave Pix cadastrada | Redireciona para cadastrar chave |
| Chave Pix inválida (Asaas rejeita) | Reembolsa saldo, sugere corrigir chave |
| Timeout Asaas (> 10s) | Reembolsa saldo, marca FAILED |
| Saldo Asaas da plataforma zerado | Reembolsa, notifica admin (crítico) |
| Saque duplo (clique duplo) | Mutex por usuário (Redis lock 30s) |

---

## Notificações Push

| Evento | Título | Corpo |
|--------|--------|-------|
| Saque OK | Pix Enviado! | R$ X,XX transferido para sua conta |
| Saque falhou | Saque não concluído | [motivo]. Saldo reembolsado. |
| Saldo plataforma baixo | (Admin) Atenção | Saldo Asaas abaixo de R$ 1000 |

---

## Testes

### Backend

| Teste | Validação |
|-------|-----------|
| Saque com saldo OK | Cria transferência, debita saldo, status COMPLETED |
| Saque com saldo insuficiente | Retorna erro, não debita |
| Saque quando Asaas falha | Reembolsa saldo, status FAILED, salva motivo |
| Saque com timeout | Reembolsa, marca FAILED |
| Clique duplo (concurrent) | Apenas um processa, outro retorna erro de lock |

### Mobile

| Teste | Validação |
|-------|-----------|
| Tela renderiza | Mostra saldo, campo valor, botão |
| Validação valor mínimo | Bloqueia envio se < R$ 10 |
| Loading state | Mostra spinner durante processamento |
| Sucesso | Navega para tela de confirmação |
| Erro | Mostra mensagem e opção de retry |

### Dev mode

Em `NODE_ENV=development`:
- Simula transferência Asaas (não chama API real)
- Delay fake de 1s para simular latência
- Sempre retorna sucesso (ou falha se valor = 666 para testar erro)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `packages/db/prisma/schema.prisma` | Adicionar campos em Withdrawal |
| `apps/api/src/integrations/asaas.ts` | Novo método `createPixTransfer()` |
| `apps/api/src/modules/payments/router.ts` | Integrar transferência no `requestWithdrawal` |
| `apps/mobile/app/withdraw.tsx` | Melhorar UX com loading, sucesso, erro |

---

## Fora do Escopo

- Antecipação de recebíveis (escrow < 1h)
- Histórico detalhado de transações
- Múltiplas chaves Pix por usuário
- Saques agendados/recorrentes
