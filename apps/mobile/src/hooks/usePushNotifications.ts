import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { trpc } from '../lib/trpc';
import { getNotificationRoute } from '../lib/notificationRoutes';

// Remote push was removed from Expo Go on ANDROID (SDK 53+): importing
// expo-notifications there throws. iOS Expo Go still gets Expo push tokens,
// so only Android-in-Expo-Go skips it (dev/production builds always load it).
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const pushUnsupported = isExpoGo && Platform.OS === 'android';
const Notifications: typeof NotificationsModule | null = pushUnsupported
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-notifications');

// Configure notification behavior
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<NotificationsModule.EventSubscription | null>(null);
  const responseListener = useRef<NotificationsModule.EventSubscription | null>(null);

  const registerMutation = trpc.profiles.registerPushToken.useMutation();

  useEffect(() => {
    if (!Notifications) {
      if (__DEV__) console.log('[PUSH] Expo Go (Android): push notifications disabled');
      return;
    }

    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // Send token to backend
        registerMutation.mutate({ token });
      }
    });

    // Listen for incoming notifications (app in foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      if (__DEV__) console.log('[PUSH] Received:', notification.request.content);
    });

    // Listen for notification interactions (user tapped)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (__DEV__) console.log('[PUSH] User tapped:', data);
      // Handle navigation based on notification type
      handleNotificationTap(data);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) return null;

  // Must be a physical device
  if (!Device.isDevice) {
    if (__DEV__) console.log('[PUSH] Push notifications require a physical device');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('[PUSH] Permission not granted');
    return null;
  }

  // Resolve the EAS project ID from app config (app.config.js -> extra.eas.projectId)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    if (__DEV__) console.warn('[PUSH] Missing EAS projectId (set EXPO_PUBLIC_EAS_PROJECT_ID); skipping token');
    return null;
  }

  // Get Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    // SECURITY: Never log push tokens in production
    if (__DEV__) console.log('[PUSH] Token:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    if (__DEV__) console.error('[PUSH] Error getting token:', error);
    return null;
  }
}

function handleNotificationTap(data: Record<string, unknown> | undefined) {
  const route = getNotificationRoute(data);
  if (route) {
    router.push(route as never);
  }
}
