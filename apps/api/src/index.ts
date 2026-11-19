import './lib/monitoring'; // first: initializes Sentry before anything else
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { trpcServer } from '@hono/trpc-server';
import { serve } from '@hono/node-server';
import { appRouter } from './router';
import { createContext } from './trpc';
import { env } from './lib/env';
import { captureError } from './lib/monitoring';
import { webhookHandler } from './modules/webhooks';
import { startEscrowProcessor } from './jobs/escrow-processor';
import { startReconciler } from './jobs/reconciler';

// Initialize Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// Webhook routes (outside tRPC - raw HTTP)
app.post('/webhooks/asaas', webhookHandler);

// tRPC handler
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    onError: ({ error, path }) => {
      // Expected errors (validation, auth, not found) are part of normal use
      if (error.code === 'INTERNAL_SERVER_ERROR') captureError(error.cause ?? error, { path });
    },
    createContext: ({ req }) => {
      // Create a minimal Hono context for tRPC
      const honoContext = {
        req: {
          raw: req,
          header: (name: string) => req.headers.get(name),
        },
      } as Parameters<typeof createContext>[0];

      return createContext(honoContext);
    },
  })
);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  captureError(err, { path: c.req.path });
  return c.json(
    {
      error: 'Internal server error',
      message: env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

// Start server
// Railway (and most hosts) inject PORT; API_PORT is the local default
const port = parseInt(process.env.PORT ?? env.API_PORT);

console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   ████████╗██████╗  █████╗ ███╗   ███╗██████╗   ║
║   ╚══██╔══╝██╔══██╗██╔══██╗████╗ ████║██╔══██╗  ║
║      ██║   ██████╔╝███████║██╔████╔██║██████╔╝  ║
║      ██║   ██╔══██╗██╔══██║██║╚██╔╝██║██╔═══╝   ║
║      ██║   ██║  ██║██║  ██║██║ ╚═╝ ██║██║       ║
║      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝       ║
║                                                  ║
║   🚀 API Server starting on port ${port}            ║
║   📍 Environment: ${env.NODE_ENV.padEnd(20)}     ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);

// Start Node.js server
serve({
  fetch: app.fetch,
  port,
});

// Start background job processors
startEscrowProcessor();
startReconciler();

// Export for testing
export { app, appRouter };
