/**
 * Idempotent seed: service categories only.
 * Upserts by slug — never deletes and never touches users, tasks or payments.
 *
 *   pnpm db:seed   (reads DATABASE_URL from the root .env)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// `icon` is an Ionicons name used by the mobile app (categoryIcon()).
const CATEGORIES = [
  { slug: 'reformas-obras', name: 'Reformas e Obras', icon: 'construct-outline', description: 'Pedreiro, reformas, acabamento e pequenas obras.' },
  { slug: 'eletrica', name: 'Elétrica', icon: 'flash-outline', description: 'Instalações, tomadas, disjuntores e iluminação.' },
  { slug: 'hidraulica', name: 'Hidráulica', icon: 'water-outline', description: 'Vazamentos, encanamento, torneiras e caixas d’água.' },
  { slug: 'limpeza', name: 'Limpeza', icon: 'sparkles-outline', description: 'Faxina residencial, pós-obra e comercial.' },
  { slug: 'jardinagem', name: 'Jardinagem', icon: 'leaf-outline', description: 'Corte de grama, poda e manutenção de jardins.' },
  { slug: 'instalacao-montagem', name: 'Instalação e Montagem', icon: 'hammer-outline', description: 'Montagem de móveis, suportes, prateleiras e cortinas.' },
  { slug: 'pintura', name: 'Pintura', icon: 'color-palette-outline', description: 'Pintura interna, externa e textura.' },
  { slug: 'ar-condicionado', name: 'Ar-condicionado', icon: 'snow-outline', description: 'Instalação, limpeza e manutenção de ar-condicionado.' },
];

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { ...c, sortOrder: i + 1 },
      update: { name: c.name, icon: c.icon, description: c.description, sortOrder: i + 1 },
    });
  }
  const total = await prisma.category.count();
  console.log(`[seed] ${CATEGORIES.length} categorias garantidas (total no banco: ${total})`);
}

main()
  .catch((err) => {
    console.error('[seed] falhou:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
