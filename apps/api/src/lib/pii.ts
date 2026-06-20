import { prisma } from '@trampo/db';
import { env } from './env';

/**
 * PII encryption at rest using Postgres pgcrypto (pgp_sym_encrypt/decrypt).
 *
 * CPF is stored encrypted in the `users.cpf_encrypted` bytea column and is
 * never persisted in plaintext. A separate SHA-256 `cpf_hash` is used for
 * uniqueness/lookups (see profiles router).
 *
 * Requires the pgcrypto extension (enabled by default on Supabase).
 */

/**
 * Encrypt and store a user's CPF at rest. The user row must already exist.
 */
export async function storeEncryptedCpf(userId: string, cpf: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE users
    SET cpf_encrypted = pgp_sym_encrypt(${cpf}, ${env.PII_ENCRYPTION_KEY})
    WHERE id = ${userId}::uuid
  `;
}

/**
 * Decrypt and return a user's CPF. Returns null when no CPF is stored.
 * Use only on the server, for KYC/verification flows — never expose to clients.
 */
export async function getDecryptedCpf(userId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ cpf: string | null }[]>`
    SELECT pgp_sym_decrypt(cpf_encrypted, ${env.PII_ENCRYPTION_KEY}) AS cpf
    FROM users
    WHERE id = ${userId}::uuid AND cpf_encrypted IS NOT NULL
  `;
  return rows[0]?.cpf ?? null;
}
