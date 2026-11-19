import { defineConfig } from 'tsup';

/**
 * Production bundle of the API. Workspace packages (@trampo/db,
 * @trampo/contracts) ship as TypeScript source, so they are bundled in;
 * Prisma stays external (it loads its generated client and engine at runtime).
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: [/^@trampo\//],
  external: ['@prisma/client', '.prisma/client'],
  clean: true,
});
