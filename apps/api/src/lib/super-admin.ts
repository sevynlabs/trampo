import { prisma } from '@trampo/db';
import { env } from './env';
import { hashPassword, verifyPassword } from '../modules/admin/auth';

/** Remembers which admin row the env vars control (so changing the e-mail renames it). */
const SETTING_KEY = 'super_admin_from_env';

/** E-mail used by scripts/seed-admin.ts when none is given. */
const DEFAULT_SEED_EMAIL = 'admin@trampo.com.br';

/**
 * Super admin managed by environment variables (SUPER_ADMIN_EMAIL,
 * SUPER_ADMIN_PASSWORD, optional SUPER_ADMIN_NAME). Runs on API startup.
 *
 * To change the super admin's e-mail or password, edit the variables (in
 * production: Railway → api → Variables) and redeploy. There is no API route
 * or panel screen for it on purpose.
 *
 * - First run: takes over the default seeded super admin (admin@trampo.com.br),
 *   or the only super admin if there is exactly one; otherwise creates one.
 * - Later runs: updates that same admin (e-mail, name, password, keeps it
 *   active and SUPER_ADMIN). Never logs the password.
 */
export async function syncSuperAdminFromEnv(): Promise<void> {
  const email = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return;

  const name = env.SUPER_ADMIN_NAME?.trim() || 'Super Admin';

  const setting = await prisma.integrationSetting.findUnique({ where: { key: SETTING_KEY } });
  const managedId = (setting?.value as { adminId?: string } | null)?.adminId;

  let target = managedId ? await prisma.adminUser.findUnique({ where: { id: managedId } }) : null;
  if (!target) target = await prisma.adminUser.findUnique({ where: { email } });
  // First run: take over the installation's default super admin (seed-admin.ts)
  if (!target) {
    const seeded = await prisma.adminUser.findUnique({ where: { email: DEFAULT_SEED_EMAIL } });
    if (seeded?.role === 'SUPER_ADMIN') target = seeded;
  }
  if (!target) {
    const supers = await prisma.adminUser.findMany({ where: { role: 'SUPER_ADMIN' }, take: 2 });
    if (supers.length === 1) target = supers[0];
  }

  // Another admin already uses the new e-mail: refuse instead of merging accounts
  if (target && target.email !== email) {
    const clash = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== target.id) {
      console.error(`[SUPER_ADMIN] ${email} já pertence a outro administrador; nada foi alterado.`);
      return;
    }
  }

  if (!target) {
    const created = await prisma.adminUser.create({
      data: { email, name, role: 'SUPER_ADMIN', passwordHash: await hashPassword(password) },
    });
    await remember(created.id);
    console.log(`[SUPER_ADMIN] Criado a partir das variáveis de ambiente: ${email}`);
    return;
  }

  const samePassword = await verifyPassword(password, target.passwordHash);
  const changes: string[] = [];
  if (target.email !== email) changes.push(`e-mail ${target.email} → ${email}`);
  if (target.name !== name && env.SUPER_ADMIN_NAME) changes.push('nome');
  if (!samePassword) changes.push('senha');
  if (target.role !== 'SUPER_ADMIN') changes.push('papel');
  if (!target.isActive) changes.push('reativado');

  if (changes.length > 0) {
    await prisma.adminUser.update({
      where: { id: target.id },
      data: {
        email,
        ...(env.SUPER_ADMIN_NAME ? { name } : {}),
        role: 'SUPER_ADMIN',
        isActive: true,
        ...(samePassword ? {} : { passwordHash: await hashPassword(password) }),
      },
    });
    await prisma.auditLog
      .create({
        data: {
          actorId: target.id,
          action: 'admin_user.sync_from_env',
          targetType: 'admin_user',
          targetId: target.id,
          metadata: { changes },
        },
      })
      .catch(() => {});
    console.log(`[SUPER_ADMIN] Atualizado pelas variáveis de ambiente: ${changes.join(', ')}`);
  }

  if (managedId !== target.id) await remember(target.id);
}

async function remember(adminId: string) {
  await prisma.integrationSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: { adminId } },
    update: { value: { adminId } },
  });
}
