# Saques Automáticos via Pix - Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar transferências Pix instantâneas quando taskers solicitam saques.

**Architecture:** Fluxo síncrono — solicita saque → debita saldo → chama Asaas Pix Transfer → atualiza status. Se falhar, reembolsa saldo atomicamente.

**Tech Stack:** Asaas API v3, tRPC, Prisma, Redis (mutex), React Native

## Global Constraints

- Valor mínimo de saque: R$ 10,00 (1000 centavos)
- Sem taxa para o tasker (TRAMPO absorve custo Asaas)
- Timeout Asaas: 10 segundos
- Mutex por usuário: 30 segundos TTL
- Em development, simula transferência (não chama Asaas real)

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `apps/api/src/lib/redis.ts` | Adicionar função `acquireLock()` para mutex |
| `apps/api/src/integrations/asaas.ts` | Adicionar `createPixTransfer()` e mock |
| `apps/api/src/modules/payments/router.ts` | Integrar transferência Pix no `requestWithdrawal` |
| `apps/mobile/app/withdraw.tsx` | Melhorar UX com estados de loading/sucesso/erro |

---

### Task 1: Redis Mutex Lock

**Files:**
- Modify: `apps/api/src/lib/redis.ts`

**Interfaces:**
- Produces: `acquireLock(key: string, ttlSeconds: number): Promise<boolean>`
- Produces: `releaseLock(key: string): Promise<void>`

- [ ] **Step 1: Add acquireLock function**

```typescript
// Add after line 56 in apps/api/src/lib/redis.ts

/**
 * Acquire a distributed lock using Redis SET NX
 * Returns true if lock acquired, false if already held
 */
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Release a distributed lock
 */
export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}
```

- [ ] **Step 2: Verify syntax by running TypeScript check**

Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

Expected: No errors related to redis.ts

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/redis.ts
git commit -m "feat(api): add Redis distributed lock for mutex"
```

---

### Task 2: Asaas Pix Transfer Integration

**Files:**
- Modify: `apps/api/src/integrations/asaas.ts`

**Interfaces:**
- Produces: `createPixTransfer(params: PixTransferParams): Promise<PixTransferResult>`
- Produces: `mockAsaas.createPixTransfer(params): Promise<MockPixTransfer>`

**Types:**
```typescript
interface PixTransferParams {
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  amount: number; // centavos
  description: string;
}

interface PixTransferResult {
  success: boolean;
  transferId?: string;
  error?: string;
  errorCode?: string;
}
```

- [ ] **Step 1: Add PixKeyType detection helper**

```typescript
// Add after line 56 (after AsaasRefund interface) in apps/api/src/integrations/asaas.ts

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

/**
 * Detect Pix key type from the key value
 */
function detectPixKeyType(pixKey: string): PixKeyType {
  const cleaned = pixKey.trim();

  // CPF: 11 digits
  if (/^\d{11}$/.test(cleaned.replace(/\D/g, '')) && cleaned.replace(/\D/g, '').length === 11) {
    return 'CPF';
  }

  // CNPJ: 14 digits
  if (/^\d{14}$/.test(cleaned.replace(/\D/g, '')) && cleaned.replace(/\D/g, '').length === 14) {
    return 'CNPJ';
  }

  // Phone: starts with + or has 10-11 digits
  if (cleaned.startsWith('+') || /^\d{10,11}$/.test(cleaned.replace(/\D/g, ''))) {
    return 'PHONE';
  }

  // Email: contains @
  if (cleaned.includes('@')) {
    return 'EMAIL';
  }

  // EVP: random key (UUID format or 32+ chars)
  return 'EVP';
}
```

- [ ] **Step 2: Add createPixTransfer function**

```typescript
// Add after detectPixKeyType function

interface PixTransferParams {
  pixKey: string;
  amount: number; // centavos
  description: string;
}

interface PixTransferResult {
  success: boolean;
  transferId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Create a Pix transfer to an external key (tasker withdrawal)
 * Uses Asaas /transfers endpoint with pixAddressKey
 */
export async function createPixTransfer(params: PixTransferParams): Promise<PixTransferResult> {
  const valueInReais = params.amount / 100;
  const pixKeyType = detectPixKeyType(params.pixKey);

  // Format phone keys to E.164
  let formattedPixKey = params.pixKey.trim();
  if (pixKeyType === 'PHONE') {
    formattedPixKey = formattedPixKey.replace(/\D/g, '');
    if (!formattedPixKey.startsWith('55')) {
      formattedPixKey = '55' + formattedPixKey;
    }
  }

  try {
    const transfer = await request<{ id: string; status: string }>('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        value: valueInReais,
        pixAddressKey: formattedPixKey,
        pixAddressKeyType: pixKeyType,
        description: params.description,
      }),
    });

    console.log(`[ASAAS] Pix transfer ${transfer.id} created: R$ ${valueInReais} to ${pixKeyType}`);

    return {
      success: true,
      transferId: transfer.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ASAAS] Pix transfer failed: ${message}`);

    // Extract error code if available
    let errorCode = 'UNKNOWN';
    if (message.includes('INSUFFICIENT_BALANCE')) errorCode = 'INSUFFICIENT_BALANCE';
    else if (message.includes('INVALID') || message.includes('invalid')) errorCode = 'INVALID_PIX_KEY';
    else if (message.includes('LIMIT')) errorCode = 'DAILY_LIMIT_EXCEEDED';

    return {
      success: false,
      error: message,
      errorCode,
    };
  }
}
```

- [ ] **Step 3: Add mock for development**

```typescript
// Add inside mockAsaas object (after getPixQrCodeBase64)

  createPixTransfer: async (params: { pixKey: string; amount: number; description: string }) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate failure for testing: amount ending in 666 fails
    if (params.amount % 1000 === 666) {
      return {
        success: false,
        error: 'Chave Pix inválida',
        errorCode: 'INVALID_PIX_KEY',
      };
    }

    return {
      success: true,
      transferId: `mock_transfer_${Date.now()}`,
    };
  },
```

- [ ] **Step 4: Verify syntax**

Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/integrations/asaas.ts
git commit -m "feat(api): add Asaas Pix transfer for withdrawals"
```

---

### Task 3: Implement Automatic Withdrawal in Router

**Files:**
- Modify: `apps/api/src/modules/payments/router.ts`

**Interfaces:**
- Consumes: `acquireLock(key, ttl)` from `../../lib/redis`
- Consumes: `releaseLock(key)` from `../../lib/redis`
- Consumes: `createPixTransfer(params)` from `../../integrations/asaas`
- Consumes: `mockAsaas.createPixTransfer(params)` from `../../integrations/asaas`

- [ ] **Step 1: Add imports**

```typescript
// Update imports at top of apps/api/src/modules/payments/router.ts
// Change line 6-11 from:
import {
  findOrCreateCustomer,
  createPixCharge,
  getPixQrCodeBase64,
  mockAsaas,
} from '../../integrations/asaas';

// To:
import {
  findOrCreateCustomer,
  createPixCharge,
  getPixQrCodeBase64,
  createPixTransfer,
  mockAsaas,
} from '../../integrations/asaas';

// Add after line 12:
import { acquireLock, releaseLock } from '../../lib/redis';
```

- [ ] **Step 2: Replace requestWithdrawal implementation**

Replace the entire `requestWithdrawal` procedure (lines 371-435) with:

```typescript
  /**
   * Request a withdrawal of the available balance to a Pix key.
   * Processes transfer immediately via Asaas Pix.
   * On failure, refunds balance automatically.
   */
  requestWithdrawal: protectedProcedure
    .input(
      z.object({
        amount: z.number().int().min(1000), // min R$ 10,00
        pixKey: z.string().min(3).max(140),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!profile) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Perfil de profissional necessário' });
      }

      // Acquire lock to prevent concurrent withdrawals
      const lockKey = `withdrawal:${ctx.user.id}`;
      const acquired = await acquireLock(lockKey, 30);
      if (!acquired) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Aguarde o processamento do saque anterior',
        });
      }

      try {
        // Calculate available balance
        const [released, withdrawals] = await Promise.all([
          prisma.payment.aggregate({
            where: { task: { assignment: { taskerId: ctx.user.id } }, status: 'RELEASED' },
            _sum: { taskerAmount: true },
          }),
          prisma.withdrawal.aggregate({
            where: { taskerProfileId: profile.id, status: { in: ['PENDING', 'PAID'] } },
            _sum: { amount: true },
          }),
        ]);
        const available = Math.max(
          0,
          (released._sum.taskerAmount ?? 0) - (withdrawals._sum.amount ?? 0)
        );

        if (input.amount > available) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Valor maior que o saldo disponível',
          });
        }

        // Save Pix key for next time
        await prisma.taskerProfile.update({
          where: { id: profile.id },
          data: { pixKey: input.pixKey },
        });

        // Create withdrawal record with PENDING status
        const withdrawal = await prisma.withdrawal.create({
          data: {
            taskerProfileId: profile.id,
            amount: input.amount,
            pixKey: input.pixKey,
            status: 'PENDING',
          },
        });

        // Process Pix transfer
        let transferResult: { success: boolean; transferId?: string; error?: string; errorCode?: string };

        if (isDev) {
          transferResult = await mockAsaas.createPixTransfer({
            pixKey: input.pixKey,
            amount: input.amount,
            description: `TRAMPO - Saque #${withdrawal.id.slice(-8)}`,
          });
        } else {
          transferResult = await createPixTransfer({
            pixKey: input.pixKey,
            amount: input.amount,
            description: `TRAMPO - Saque #${withdrawal.id.slice(-8)}`,
          });
        }

        if (transferResult.success) {
          // Success: update withdrawal status
          const updated = await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: 'PAID',
              asaasTransferId: transferResult.transferId,
              paidAt: new Date(),
            },
          });

          console.log(
            `[PAYMENTS] Withdrawal ${withdrawal.id} completed: ${input.amount} centavos to ${input.pixKey}`
          );

          return {
            id: updated.id,
            status: updated.status,
            amount: updated.amount,
          };
        } else {
          // Failure: mark as failed (balance is not deducted since status != PAID)
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: 'FAILED',
              failureReason: transferResult.errorCode || transferResult.error,
            },
          });

          console.error(
            `[PAYMENTS] Withdrawal ${withdrawal.id} failed: ${transferResult.error}`
          );

          // Translate error to user-friendly message
          let userMessage = 'Falha ao processar saque. Tente novamente.';
          if (transferResult.errorCode === 'INVALID_PIX_KEY') {
            userMessage = 'Chave Pix inválida. Verifique e tente novamente.';
          } else if (transferResult.errorCode === 'INSUFFICIENT_BALANCE') {
            userMessage = 'Erro temporário. Tente novamente em alguns minutos.';
          } else if (transferResult.errorCode === 'DAILY_LIMIT_EXCEEDED') {
            userMessage = 'Limite diário atingido. Tente novamente amanhã.';
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: userMessage,
          });
        }
      } finally {
        // Always release lock
        await releaseLock(lockKey);
      }
    }),
```

- [ ] **Step 3: Update balance query to exclude FAILED withdrawals**

Find the `balance` procedure and update the withdrawals query (around line 351-354):

```typescript
// Change:
      prisma.withdrawal.aggregate({
        where: { taskerProfileId: profile.id, status: { in: ['PENDING', 'PAID'] } },
        _sum: { amount: true },
      }),

// To:
      prisma.withdrawal.aggregate({
        where: { taskerProfileId: profile.id, status: 'PAID' },
        _sum: { amount: true },
      }),
```

Also update in requestWithdrawal (the one we just added):

```typescript
// Change the withdrawals aggregate inside requestWithdrawal from:
          prisma.withdrawal.aggregate({
            where: { taskerProfileId: profile.id, status: { in: ['PENDING', 'PAID'] } },
            _sum: { amount: true },
          }),

// To:
          prisma.withdrawal.aggregate({
            where: { taskerProfileId: profile.id, status: 'PAID' },
            _sum: { amount: true },
          }),
```

- [ ] **Step 4: Verify syntax**

Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -30`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payments/router.ts
git commit -m "feat(api): implement automatic Pix withdrawal via Asaas"
```

---

### Task 4: Add FAILED Status to Withdrawal Enum

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Interfaces:**
- Produces: Updated `WithdrawalStatus` enum with `FAILED` value

- [ ] **Step 1: Check current WithdrawalStatus enum**

Run: `grep -A5 "enum WithdrawalStatus" /Users/softsales/Documents/SEVYN\ LABS/app-trampo/packages/db/prisma/schema.prisma`

- [ ] **Step 2: Add FAILED to enum if not present**

If FAILED is not in the enum, find `enum WithdrawalStatus` and update:

```prisma
enum WithdrawalStatus {
  PENDING
  PAID
  FAILED
}
```

- [ ] **Step 3: Generate Prisma client**

Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm db:generate`

Expected: Prisma Client generated successfully

- [ ] **Step 4: Push schema to database**

Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm db:push`

Expected: Schema synchronized

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add FAILED status to WithdrawalStatus enum"
```

---

### Task 5: Improve Mobile Withdrawal UX

**Files:**
- Modify: `apps/mobile/app/withdraw.tsx`

**Interfaces:**
- Consumes: `trpc.payments.requestWithdrawal` mutation (returns `{ id, status, amount }`)
- Consumes: `trpc.payments.balance` query (returns `{ available, pending, withdrawn, pixKey }`)

- [ ] **Step 1: Add state for success screen**

Replace the entire `apps/mobile/app/withdraw.tsx` with:

```typescript
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, BounceIn } from 'react-native-reanimated';
import { trpc } from '../src/lib/trpc';
import { formatCurrency } from '../src/lib/format';
import { GradientButton } from '../src/components/GradientButton';

type ScreenState = 'form' | 'processing' | 'success' | 'error';

export default function WithdrawScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: balance, isLoading } = trpc.payments.balance.useQuery();
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<{ amount: number; id: string } | null>(null);

  const available = balance?.available ?? 0;

  useEffect(() => {
    if (balance) {
      if (balance.pixKey) setPixKey(balance.pixKey);
      setAmount((balance.available / 100).toFixed(2));
    }
  }, [balance]);

  const requestWithdrawal = trpc.payments.requestWithdrawal.useMutation({
    onMutate: () => {
      setScreenState('processing');
      setErrorMessage('');
    },
    onSuccess: (res) => {
      utils.payments.balance.invalidate();
      utils.payments.listForTasker.invalidate();
      setSuccessData({ amount: res.amount, id: res.id });
      setScreenState('success');
    },
    onError: (err) => {
      setErrorMessage(err.message);
      setScreenState('error');
    },
  });

  const amountCents = Math.round(parseFloat(amount.replace(',', '.') || '0') * 100);
  const valid =
    amountCents >= 1000 && amountCents <= available && pixKey.trim().length >= 3;

  const handleSubmit = () => {
    if (!valid) return;
    requestWithdrawal.mutate({ amount: amountCents, pixKey: pixKey.trim() });
  };

  const handleRetry = () => {
    setScreenState('form');
    setErrorMessage('');
  };

  const maskPixKey = (key: string) => {
    if (key.includes('@')) {
      const [user, domain] = key.split('@');
      return `${user.slice(0, 2)}****@${domain}`;
    }
    if (key.length > 6) {
      return `****${key.slice(-4)}`;
    }
    return '****';
  };

  // Processing Screen
  if (screenState === 'processing') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centeredContainer}>
          <Animated.View entering={FadeIn.duration(300)} style={styles.processingCard}>
            <ActivityIndicator size="large" color="#018ABE" />
            <Text style={styles.processingTitle}>Enviando Pix...</Text>
            <Text style={styles.processingSubtitle}>
              Transferindo {formatCurrency(amountCents)}
            </Text>
          </Animated.View>
        </View>
      </>
    );
  }

  // Success Screen
  if (screenState === 'success' && successData) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centeredContainer}>
          <Animated.View entering={BounceIn.duration(500)} style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#0E9F6E" />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(200)} style={styles.successTitle}>
            Pix Enviado!
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300)} style={styles.successAmount}>
            {formatCurrency(successData.amount)}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(400)} style={styles.successDetail}>
            para {maskPixKey(pixKey)}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(500)} style={styles.successId}>
            ID: {successData.id.slice(-8).toUpperCase()}
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(600)} style={styles.successButton}>
            <GradientButton
              label="Voltar"
              onPress={() => router.back()}
              iconRight="arrow-forward"
            />
          </Animated.View>
        </View>
      </>
    );
  }

  // Error Screen
  if (screenState === 'error') {
    const isPixKeyError = errorMessage.toLowerCase().includes('pix') ||
                          errorMessage.toLowerCase().includes('chave');

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centeredContainer}>
          <Animated.View entering={BounceIn.duration(500)} style={styles.errorIcon}>
            <Ionicons name="close-circle" size={80} color="#E11D48" />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(200)} style={styles.errorTitle}>
            Saque não concluído
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300)} style={styles.errorMessage}>
            {errorMessage}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(400)} style={styles.errorRefund}>
            Seu saldo foi mantido.
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(500)} style={styles.errorButtons}>
            {isPixKeyError ? (
              <GradientButton
                label="Corrigir chave Pix"
                onPress={handleRetry}
                icon="key-outline"
              />
            ) : (
              <GradientButton
                label="Tentar novamente"
                onPress={handleRetry}
                icon="refresh-outline"
              />
            )}
            <Pressable onPress={() => router.back()} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </Animated.View>
        </View>
      </>
    );
  }

  // Form Screen (default)
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Sacar',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.headerBack}>
              <Ionicons name="arrow-back" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#018ABE" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Available Balance */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Disponível para saque</Text>
              <Text style={styles.balanceValue}>{formatCurrency(available)}</Text>
            </View>

            {/* Amount Input */}
            <Text style={styles.inputLabel}>Valor</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#94B2C4"
                style={styles.amountInput}
              />
              <Pressable onPress={() => setAmount((available / 100).toFixed(2))} hitSlop={8}>
                <Text style={styles.allButton}>TUDO</Text>
              </Pressable>
            </View>
            <Text style={styles.minText}>Mínimo R$ 10,00</Text>

            {/* Pix Key Input */}
            <Text style={styles.inputLabel}>Chave Pix</Text>
            <TextInput
              value={pixKey}
              onChangeText={setPixKey}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              placeholderTextColor="#94B2C4"
              style={styles.pixKeyInput}
            />

            <GradientButton
              label="Solicitar saque"
              icon="cash-outline"
              onPress={handleSubmit}
              disabled={!valid}
            />

            {available < 1000 && (
              <Text style={styles.minBalanceText}>
                Você precisa de pelo menos R$ 10,00 disponíveis para sacar.
              </Text>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  headerBack: {
    marginRight: 16,
  },
  balanceCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#DCEAF1',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#5B7A91',
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#001B48',
    marginTop: 4,
  },
  inputLabel: {
    color: '#001B48',
    fontWeight: '500',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#DCEAF1',
    borderRadius: 9999,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  currencyPrefix: {
    color: '#5B7A91',
    fontWeight: '700',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 8,
    color: '#001B48',
    fontSize: 18,
  },
  allButton: {
    color: '#018ABE',
    fontWeight: '700',
    fontSize: 14,
  },
  minText: {
    color: '#94B2C4',
    fontSize: 12,
    marginBottom: 24,
  },
  pixKeyInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#DCEAF1',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#001B48',
    marginBottom: 32,
  },
  minBalanceText: {
    color: '#5B7A91',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 16,
  },
  // Centered screens (processing, success, error)
  centeredContainer: {
    flex: 1,
    backgroundColor: '#F3F8FB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  processingCard: {
    alignItems: 'center',
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#001B48',
    marginTop: 24,
  },
  processingSubtitle: {
    fontSize: 16,
    color: '#5B7A91',
    marginTop: 8,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0E9F6E',
  },
  successAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#001B48',
    marginTop: 8,
  },
  successDetail: {
    fontSize: 16,
    color: '#5B7A91',
    marginTop: 8,
  },
  successId: {
    fontSize: 14,
    color: '#94B2C4',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  successButton: {
    marginTop: 32,
    width: '100%',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E11D48',
  },
  errorMessage: {
    fontSize: 16,
    color: '#5B7A91',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  errorRefund: {
    fontSize: 14,
    color: '#0E9F6E',
    marginTop: 16,
    fontWeight: '500',
  },
  errorButtons: {
    marginTop: 32,
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#5B7A91',
    fontSize: 16,
  },
});
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm exec tsc --noEmit -p apps/mobile/tsconfig.json 2>&1 | head -20`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/withdraw.tsx
git commit -m "feat(mobile): improve withdrawal UX with processing/success/error states"
```

---

### Task 6: Test End-to-End Flow

**Files:**
- None (manual testing)

- [ ] **Step 1: Start the API server**

Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm dev:api`

Expected: API running on port 3000

- [ ] **Step 2: Start the mobile app**

In a new terminal:
Run: `cd /Users/softsales/Documents/SEVYN\ LABS/app-trampo && pnpm dev:mobile`

- [ ] **Step 3: Test happy path**

1. Login as a tasker with released balance
2. Navigate to Earnings → Withdraw
3. Enter amount and Pix key
4. Submit and verify success screen appears
5. Check balance decreased

- [ ] **Step 4: Test error handling (dev mode)**

1. Enter amount ending in 666 (e.g., R$ 16,66 = 1666 centavos)
2. Submit and verify error screen appears
3. Confirm balance is unchanged

- [ ] **Step 5: Test concurrent request protection**

1. Open two browser tabs or use curl
2. Submit withdrawal in both simultaneously
3. Verify only one succeeds, other gets "Aguarde o processamento" error

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: withdrawal integration complete"
```

---

## Self-Review Checklist

- [x] All spec requirements have corresponding tasks
- [x] No TBD/TODO placeholders in code
- [x] Type signatures consistent across tasks (PixTransferResult used in Task 2 and consumed in Task 3)
- [x] File paths verified against actual codebase
- [x] Prisma schema already has needed fields (asaasTransferId, failureReason)
- [x] Dev mode mocking included for testing without Asaas
