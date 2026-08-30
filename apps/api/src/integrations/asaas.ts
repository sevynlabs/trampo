import { env } from '../lib/env';

/**
 * Asaas API Integration
 *
 * Payment flow:
 * 1. Create customer (if new client)
 * 2. Create Pix charge
 * 3. Client pays via Pix
 * 4. Webhook confirms payment → status: CONFIRMED
 * 5. Task completed → status: HELD (escrow)
 * 6. 1 hour later → Transfer to tasker → status: RELEASED
 */

const BASE_URL =
  env.ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

interface AsaasError {
  errors: Array<{ code: string; description: string }>;
}

interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  phone?: string;
}

interface AsaasCharge {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  billingType: 'PIX';
  status: string;
  invoiceUrl: string;
  pixTransaction?: {
    payload: string; // Pix copia-e-cola
    qrCodeUrl: string; // QR code image URL
    expirationDate: string;
  };
}

interface AsaasTransfer {
  id: string;
  value: number;
  status: string;
}

interface AsaasRefund {
  id: string;
  value: number;
  status: string;
}

// Pix transfer types and interfaces
type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

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
 * Detect the type of Pix key from its value
 * - CPF: 11 digits
 * - CNPJ: 14 digits
 * - PHONE: starts with + or has 10-11 digits
 * - EMAIL: contains @
 * - EVP: random/UUID key (default)
 */
function detectPixKeyType(pixKey: string): PixKeyType {
  // Remove non-digits to check length
  const digitsOnly = pixKey.replace(/\D/g, '');

  // Check CNPJ (14 digits)
  if (digitsOnly.length === 14) {
    return 'CNPJ';
  }

  // Check CPF (11 digits)
  if (digitsOnly.length === 11) {
    return 'CPF';
  }

  // Check EMAIL (contains @)
  if (pixKey.includes('@')) {
    return 'EMAIL';
  }

  // Check PHONE (starts with + or has 10-11 digits)
  if (pixKey.startsWith('+') || (digitsOnly.length === 10 || digitsOnly.length === 11)) {
    return 'PHONE';
  }

  // Default to EVP (random/UUID key)
  return 'EVP';
}

/**
 * Create a Pix transfer for tasker withdrawal
 * Transfers money from platform account to tasker's Pix key
 */
export async function createPixTransfer(params: PixTransferParams): Promise<PixTransferResult> {
  try {
    const valueInReais = params.amount / 100;
    const pixKeyType = detectPixKeyType(params.pixKey);

    // Format phone key with 55 prefix if needed
    let formattedPixKey = params.pixKey;
    if (pixKeyType === 'PHONE' && !params.pixKey.startsWith('+55')) {
      const digitsOnly = params.pixKey.replace(/\D/g, '');
      formattedPixKey = `+55${digitsOnly}`;
    }

    const transfer = await request<{ id: string; status: string }>('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        pixAddressKey: formattedPixKey,
        value: valueInReais,
        description: params.description,
      }),
    });

    console.log(`[ASAAS] Pix transfer ${transfer.id} to ${pixKeyType}: R$ ${valueInReais}`);

    return {
      success: true,
      transferId: transfer.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ASAAS] Pix transfer failed:', errorMessage);

    // Map common Asaas errors
    let errorCode = 'UNKNOWN_ERROR';
    if (errorMessage.includes('saldo insuficiente')) {
      errorCode = 'INSUFFICIENT_BALANCE';
    } else if (errorMessage.includes('Chave Pix inválida')) {
      errorCode = 'INVALID_PIX_KEY';
    } else if (errorMessage.includes('limite')) {
      errorCode = 'DAILY_LIMIT_EXCEEDED';
    }

    return {
      success: false,
      error: errorMessage,
      errorCode,
    };
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: env.ASAAS_API_KEY,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as AsaasError;
    const message = error.errors?.[0]?.description || 'Asaas API error';
    console.error('[ASAAS] Error:', message, error);
    throw new Error(message);
  }

  return data as T;
}

/**
 * Find or create customer in Asaas
 */
export async function findOrCreateCustomer(params: {
  name: string;
  cpf: string;
  phone: string;
  externalReference: string; // Our user ID
}): Promise<AsaasCustomer> {
  // Try to find existing
  const existing = await request<{ data: AsaasCustomer[] }>(
    `/customers?externalReference=${params.externalReference}`
  );

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer
  const customer = await request<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      cpfCnpj: params.cpf.replace(/\D/g, ''),
      phone: params.phone.replace(/\D/g, ''),
      externalReference: params.externalReference,
    }),
  });

  console.log(`[ASAAS] Created customer: ${customer.id}`);
  return customer;
}

/**
 * Create a Pix charge for the full task amount, payable to the platform account.
 *
 * DECISION — no Asaas split (intentional, not a TODO):
 * Asaas split credits the split recipients when the payment is confirmed, which
 * would pay the tasker before the work is done. That conflicts with our escrow
 * model (the tasker's amount is held and only released ~1h after task
 * completion — an immutable business rule, see CLAUDE.md). So we collect the
 * full amount here and pay the tasker via a separate, escrow-timed transfer
 * (see transferToTasker / processEscrowRelease). Do not reintroduce split
 * without revisiting the escrow guarantee.
 *
 * @param customerId - Asaas customer ID
 * @param amount - Total amount in centavos
 * @param externalReference - Our payment ID
 * @param description - Payment description
 */
export async function createPixCharge(params: {
  customerId: string;
  amount: number;
  externalReference: string;
  description: string;
}): Promise<AsaasCharge> {
  // Asaas uses BRL (reais), not centavos
  const valueInReais = params.amount / 100;

  const body: Record<string, unknown> = {
    customer: params.customerId,
    billingType: 'PIX',
    value: valueInReais,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 24h
    description: params.description,
    externalReference: params.externalReference,
  };

  const charge = await request<AsaasCharge>('/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  console.log(`[ASAAS] Created charge: ${charge.id} for R$ ${valueInReais}`);

  // Get Pix details
  const pixDetails = await request<{
    payload: string;
    expirationDate: string;
  }>(`/payments/${charge.id}/pixQrCode`);

  return {
    ...charge,
    pixTransaction: {
      payload: pixDetails.payload,
      qrCodeUrl: `${BASE_URL}/payments/${charge.id}/pixQrCode`,
      expirationDate: pixDetails.expirationDate,
    },
  };
}

/**
 * Get charge status
 */
export async function getChargeStatus(chargeId: string): Promise<AsaasCharge> {
  return request<AsaasCharge>(`/payments/${chargeId}`);
}

/**
 * Create subaccount for tasker (wallet)
 * This allows us to transfer money to taskers
 */
export async function createTaskerWallet(params: {
  name: string;
  cpf: string;
  phone: string;
  email?: string;
  externalReference: string; // Our tasker profile ID
}): Promise<{ id: string; walletId: string }> {
  const subaccount = await request<{ id: string; walletId: string }>('/accounts', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      cpfCnpj: params.cpf.replace(/\D/g, ''),
      mobilePhone: params.phone.replace(/\D/g, ''),
      email: params.email,
      externalReference: params.externalReference,
      companyType: 'INDIVIDUAL',
    }),
  });

  console.log(`[ASAAS] Created tasker wallet: ${subaccount.walletId}`);
  return subaccount;
}

/**
 * Transfer money to tasker
 * Called after escrow period (1 hour after task completion)
 */
export async function transferToTasker(params: {
  walletId: string;
  amount: number; // In centavos
  description: string;
  externalReference: string; // Our payment ID
}): Promise<AsaasTransfer> {
  const valueInReais = params.amount / 100;

  const transfer = await request<AsaasTransfer>('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      walletId: params.walletId,
      value: valueInReais,
      description: params.description,
      externalReference: params.externalReference,
    }),
  });

  console.log(`[ASAAS] Transfer ${transfer.id} to wallet ${params.walletId}: R$ ${valueInReais}`);
  return transfer;
}

/**
 * Look up an existing transfer by our externalReference (the payment ID).
 *
 * Used to make escrow release idempotent: if a previous attempt already moved
 * the money but failed before we recorded it, we must NOT transfer again.
 *
 * TODO(asaas): confirm the `/transfers` list endpoint supports filtering by
 * `externalReference` in the target Asaas API version. If it does not, fall back
 * to listing recent transfers and matching client-side, or store the transfer id
 * before posting (two-phase) — see ensureTransferToTasker.
 */
export async function findTransferByExternalReference(
  externalReference: string
): Promise<AsaasTransfer | null> {
  const res = await request<{ data: AsaasTransfer[] }>(
    `/transfers?externalReference=${encodeURIComponent(externalReference)}`
  );

  // Ignore transfers that failed/were cancelled — those should be retried.
  const settled = res.data?.find(
    (t) => t.status !== 'FAILED' && t.status !== 'CANCELLED'
  );
  return settled ?? null;
}

/**
 * Idempotent transfer: skip the POST when a transfer for this payment already
 * exists at Asaas. Safe to call on retries after a partial failure.
 */
export async function ensureTransferToTasker(params: {
  walletId: string;
  amount: number;
  description: string;
  externalReference: string; // Our payment ID — the idempotency key
}): Promise<AsaasTransfer> {
  const existing = await findTransferByExternalReference(params.externalReference);
  if (existing) {
    console.log(
      `[ASAAS] Transfer already exists for ${params.externalReference} (${existing.id}); skipping POST`
    );
    return existing;
  }
  return transferToTasker(params);
}

/**
 * Refund a payment (full or partial)
 */
export async function refundPayment(params: {
  chargeId: string;
  amount?: number; // In centavos (optional, full refund if not provided)
  description?: string;
}): Promise<AsaasRefund> {
  const body: Record<string, unknown> = {
    description: params.description || 'Reembolso',
  };

  if (params.amount) {
    body.value = params.amount / 100;
  }

  const refund = await request<AsaasRefund>(`/payments/${params.chargeId}/refund`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  console.log(`[ASAAS] Refund ${refund.id} for charge ${params.chargeId}`);
  return refund;
}

/**
 * Get Pix QR Code image as base64
 */
export async function getPixQrCodeBase64(chargeId: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/payments/${chargeId}/pixQrCode`, {
    headers: {
      access_token: env.ASAAS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get QR code');
  }

  const data = (await response.json()) as { encodedImage: string };
  return data.encodedImage; // Base64 image
}

/**
 * Development mock for testing without Asaas
 */
export const mockAsaas = {
  createPixCharge: async (params: {
    externalReference: string;
    amount: number;
    description: string;
  }) => ({
    id: `mock_charge_${Date.now()}`,
    customer: 'mock_customer',
    value: params.amount / 100,
    netValue: params.amount / 100,
    billingType: 'PIX' as const,
    status: 'PENDING',
    invoiceUrl: 'https://sandbox.asaas.com/mock',
    pixTransaction: {
      payload: '00020126580014br.gov.bcb.pix0136mock-pix-code-for-testing',
      qrCodeUrl: 'https://via.placeholder.com/200?text=PIX+QR+Code',
      expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  }),

  findOrCreateCustomer: async (params: { externalReference: string }) => ({
    id: `mock_customer_${params.externalReference}`,
    name: 'Mock Customer',
    cpfCnpj: '00000000000',
  }),

  getPixQrCodeBase64: async () =>
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',

  createPixTransfer: async (params: { pixKey: string; amount: number; description: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Fail if amount ends in 666 (for testing)
    if (params.amount % 1000 === 666) {
      return { success: false, error: 'Chave Pix inválida', errorCode: 'INVALID_PIX_KEY' };
    }
    return { success: true, transferId: `mock_transfer_${Date.now()}` };
  },
};
