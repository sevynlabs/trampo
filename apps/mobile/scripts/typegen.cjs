/**
 * Generates Expo Router typed routes (.expo/types/router.d.ts) and
 * expo-env.d.ts without starting Metro — needed for `tsc` in CI, where
 * `expo start` never runs. Uses the same function `expo start` calls.
 */
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const cli = path.dirname(require.resolve('@expo/cli/package.json', { paths: [projectRoot] }));
const { startTypescriptTypeGenerationAsync } = require(
  path.join(cli, 'build/src/start/server/type-generation/startTypescriptTypeGeneration.js')
);

startTypescriptTypeGenerationAsync({ projectRoot, metro: null, server: null })
  .then(() => console.log('[typegen] typed routes generated'))
  .catch((err) => {
    console.error('[typegen] failed:', err);
    process.exit(1);
  });
