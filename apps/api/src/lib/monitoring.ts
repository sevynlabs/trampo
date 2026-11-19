import * as Sentry from '@sentry/node';

/**
 * Error monitoring (Sentry). Off until SENTRY_DSN is set, so local
 * development and tests never send anything.
 */
const dsn = process.env.SENTRY_DSN;
export const monitoringEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
  });
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!monitoringEnabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
