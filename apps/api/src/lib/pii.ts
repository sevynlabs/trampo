import { prisma, Prisma } from '@trampo/db';
import { env } from './env';

// Either the root client or a transaction client — both expose $executeRaw.
type Db = typeof prisma | Prisma.TransactionClient;

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
 * Pass a transaction client (`db`) to keep this write atomic with the row insert/update.
 */
export async function storeEncryptedCpf(
  userId: string,
  cpf: string,
  db: Db = prisma
): Promise<void> {
  await db.$executeRaw`
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
