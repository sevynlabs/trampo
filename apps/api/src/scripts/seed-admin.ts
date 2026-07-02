/**
 * Seed an initial admin user for the admin panel.
 *
 * Usage:
 *   ADMIN_SEED_EMAIL=you@trampo.com.br ADMIN_SEED_PASSWORD='strong-pass' \
 *     pnpm --filter @trampo/api seed:admin
 *
 * Falls back to dev defaults if the env vars are not set (and warns loudly).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

// Load DATABASE_URL (+ others) from the repo root .env before importing prisma.
const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(here, '../../../../.env'),
  path.resolve(here, '../../.env'),
]) {
  try {
    loadEnvFile(candidate);
    break;
  } catch {
    // try next candidate
  }
}

const { prisma } = await import('@trampo/db');
const { hashPassword } = await import('../modules/admin/auth');

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL || 'admin@trampo.com.br')
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || 'trampo-admin-123';
  const name = process.env.ADMIN_SEED_NAME || 'Super Admin';

  const usingDefaultPassword = !process.env.ADMIN_SEED_PASSWORD;

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Admin already exists: ${email} (role: ${existing.role})`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.adminUser.create({
    data: { email, passwordHash, name, role: 'SUPER_ADMIN' },
  });

  console.log(`✅ Created SUPER_ADMIN: ${admin.email}`);
  if (usingDefaultPassword) {
    console.warn(
      `⚠️  Using DEFAULT password "${password}". Change it immediately in production!`
    );
  }
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
