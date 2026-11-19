import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reporting (Sentry). Only active in store/preview builds
 * that have EXPO_PUBLIC_SENTRY_DSN set; never in development or Expo Go.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const monitoringEnabled = !!dsn && !__DEV__;

if (monitoringEnabled) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}

export function withMonitoring(Component: () => React.JSX.Element): React.ComponentType {
  return monitoringEnabled ? Sentry.wrap(Component) : Component;
}
