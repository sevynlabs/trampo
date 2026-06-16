import { router, publicProcedure } from '../../trpc';
import { prisma } from '@trampo/db';

export const categoriesRouter = router({
  /**
   * List all active categories
   */
  list: publicProcedure.query(async () => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        icon: true,
        description: true,
      },
    });

    return categories;
  }),
});
