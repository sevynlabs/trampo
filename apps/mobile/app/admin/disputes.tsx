import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';

export default function AdminDisputesScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading, refetch, isRefetching, error } =
    trpc.disputes.listOpen.useQuery();

  const resolve = trpc.disputes.resolve.useMutation({
    onSuccess: (res) => {
      Alert.alert(
        'Disputa resolvida',
        res.outcome === 'RELEASE'
          ? 'Pagamento liberado ao profissional.'
          : 'Valor reembolsado ao cliente.'
      );
      utils.disputes.listOpen.invalidate();
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const confirmResolve = (
    taskId: string,
    taskTitle: string,
    outcome: 'RELEASE' | 'REFUND'
  ) => {
    const action =
      outcome === 'RELEASE' ? 'liberar o pagamento ao profissional' : 'reembolsar o cliente';
    Alert.alert(
      'Confirmar resolução',
      `Tem certeza que deseja ${action} no trampo "${taskTitle}"? Esta ação é irreversível.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: outcome === 'REFUND' ? 'destructive' : 'default',
          onPress: () => resolve.mutate({ taskId, outcome }),
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Disputas',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#18181B" />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {isLoading && (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        )}

        {error && (
          <View className="bg-danger/10 border border-danger/20 rounded-card p-4">
            <Text className="text-danger">{error.message}</Text>
          </View>
        )}

        {data && data.length === 0 && (
          <View className="py-20 items-center">
            <Ionicons name="checkmark-circle-outline" size={48} color="#16A34A" />
            <Text className="text-ink-muted mt-3">Nenhuma disputa aberta 🎉</Text>
          </View>
        )}

        {data?.map((dispute) => {
          const task = dispute.task;
          const tasker = task.assignment?.tasker;
          return (
            <View
              key={dispute.id}
              className="bg-surface rounded-card border border-border p-4 mb-4"
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text className="font-bold text-ink flex-1 mr-2">{task.title}</Text>
                {task.payment && (
                  <Text className="text-accent font-bold">
                    {formatCurrency(task.payment.amount)}
                  </Text>
                )}
              </View>

              <Text className="text-ink-soft text-sm mb-3" numberOfLines={4}>
                {dispute.reason}
              </Text>

              <View className="border-t border-border pt-3 mb-3">
                <Text className="text-ink-muted text-xs">
                  Cliente: <Text className="text-ink">{task.client.name ?? '—'}</Text>
                  {'   '}({task.client.phone})
                </Text>
                <Text className="text-ink-muted text-xs mt-1">
                  Profissional: <Text className="text-ink">{tasker?.name ?? '—'}</Text>
                  {tasker?.phone ? `   (${tasker.phone})` : ''}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  disabled={resolve.isPending}
                  onPress={() => confirmResolve(task.id, task.title, 'RELEASE')}
                  className="flex-1 bg-success py-3 rounded-button items-center"
                >
                  <Text className="text-white font-bold text-sm">Liberar p/ profissional</Text>
                </Pressable>
                <Pressable
                  disabled={resolve.isPending}
                  onPress={() => confirmResolve(task.id, task.title, 'REFUND')}
                  className="flex-1 bg-danger py-3 rounded-button items-center"
                >
                  <Text className="text-white font-bold text-sm">Reembolsar cliente</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}
