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
  // SECURITY: Password is REQUIRED - no default allowed
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) {
    console.error('❌ ADMIN_SEED_PASSWORD is required. No default password allowed for security.');
    console.error('   Usage: ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=... pnpm --filter @trampo/api seed:admin');
    process.exitCode = 1;
    return;
  }

  if (password.length < 12) {
    console.error('❌ ADMIN_SEED_PASSWORD must be at least 12 characters long.');
    process.exitCode = 1;
    return;
  }

  const email = (process.env.ADMIN_SEED_EMAIL || 'admin@trampo.com.br')
    .trim()
    .toLowerCase();
  const name = process.env.ADMIN_SEED_NAME || 'Super Admin';

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
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
