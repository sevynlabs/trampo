import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { trpc } from '../lib/trpc';

// Configure notification behavior
Notifications.setNotificationHandler({
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
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  const registerMutation = trpc.profiles.registerPushToken.useMutation();

  useEffect(() => {
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
      console.log('[PUSH] Received:', notification.request.content);
    });

    // Listen for notification interactions (user tapped)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[PUSH] User tapped:', data);
      // Handle navigation based on notification type
      handleNotificationTap(data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return { expoPushToken };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Must be a physical device
  if (!Device.isDevice) {
    console.log('[PUSH] Push notifications require a physical device');
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
    console.log('[PUSH] Permission not granted');
    return null;
  }

  // Get Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // Replace with your Expo project ID
    });
    console.log('[PUSH] Token:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('[PUSH] Error getting token:', error);
    return null;
  }
}

function handleNotificationTap(data: Record<string, unknown>) {
  // Navigation will be handled by the app based on notification type
  // This is a placeholder - integrate with your navigation
  const type = data?.type as string;

  switch (type) {
    case 'task_accepted':
    case 'task_completed':
    case 'payment_confirmed':
      // Navigate to task details
      break;
    case 'new_message':
      // Navigate to chat
      break;
    case 'payment_released':
      // Navigate to earnings
      break;
  }
}
