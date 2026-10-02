import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../src/lib/trpc';
import { EmptyState, EmptyInboxIllustration } from '../src/components/illustrations';
import { getNotificationRoute } from '../src/lib/notificationRoutes';

const ICON_BY_TYPE: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  task_accepted: { icon: 'checkmark-circle', color: '#0E9F6E' },
  payment_confirmed: { icon: 'shield-checkmark', color: '#018ABE' },
  task_completed: { icon: 'checkmark-done-circle', color: '#0E9F6E' },
  payment_released: { icon: 'cash', color: '#0E9F6E' },
  new_message: { icon: 'chatbubble-ellipses', color: '#018ABE' },
  task_cancelled: { icon: 'close-circle', color: '#E11D48' },
  new_review: { icon: 'star', color: '#F59E0B' },
  dispute_opened: { icon: 'alert-circle', color: '#E11D48' },
  dispute_resolved: { icon: 'checkmark-circle', color: '#0E9F6E' },
  generic: { icon: 'notifications', color: '#5B7A91' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading, refetch, isRefetching } = trpc.notifications.list.useQuery();
  const markAllRead = trpc.notifications.markAllRead.useMutation();

  // Mark everything read when the screen opens.
  useEffect(() => {
    markAllRead.mutate(undefined, {
      onSuccess: () => utils.notifications.unreadCount.invalidate(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = data?.items ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notificações',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              className="mr-4"
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Ionicons name="arrow-back" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator size="large" color="#018ABE" />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 bg-background">
          <EmptyState
            illustration={EmptyInboxIllustration}
            title="Nenhuma notificação"
            subtitle="Quando algo acontecer nos seus trampos, você verá por aqui."
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {items.map((n) => {
            const cfg = ICON_BY_TYPE[n.type] ?? ICON_BY_TYPE.generic;
            const route = getNotificationRoute(n.data as Record<string, unknown> | null);
            return (
              <Pressable
                key={n.id}
                disabled={!route}
                onPress={() => route && router.push(route as never)}
                accessibilityRole={route ? 'button' : undefined}
                className={`flex-row items-start rounded-card p-4 mb-2 border ${
                  n.read ? 'bg-surface border-border' : 'bg-accent/5 border-accent/20'
                }`}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${cfg.color}1A` }}
                >
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-ink flex-1 mr-2" numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text className="text-ink-muted text-xs">{timeAgo(n.createdAt)}</Text>
                  </View>
                  <Text className="text-ink-muted text-sm mt-0.5 leading-5">{n.body}</Text>
                </View>
                {!n.read && <View className="w-2 h-2 rounded-full bg-accent ml-2 mt-2" />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </>
  );
}
