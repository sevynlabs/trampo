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
  split?: Array<{
    walletId: string;
    fixedValue?: number;
    percentualValue?: number;
  }>;
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
 * Create Pix charge with split for tasker
 *
 * @param customerId - Asaas customer ID
 * @param amount - Total amount in centavos
 * @param taskerWalletId - Tasker's Asaas wallet ID (for split)
 * @param taskerAmount - Amount for tasker in centavos
 * @param externalReference - Our payment ID
 * @param description - Payment description
 */
export async function createPixCharge(params: {
  customerId: string;
  amount: number;
  taskerWalletId?: string;
  taskerAmount?: number;
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

  // Add split if tasker wallet is provided
  // For now, we won't use split - we'll transfer manually after escrow
  // This is simpler and gives us more control over the escrow timing

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
};
