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

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <View className="flex-1 bg-surface rounded-card border border-border p-4">
      <Text className="text-ink-muted text-xs mb-1">{label}</Text>
      <Text className={`font-display text-2xl font-bold ${warn ? 'text-danger' : 'text-ink'}`}>
        {value}
      </Text>
    </View>
  );
}

export default function AdminOpsScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const status = trpc.admin.settlementStatus.useQuery();
  const dlq = trpc.admin.deadLetterQueue.useQuery();

  const reconcile = trpc.admin.reconcile.useMutation({
    onSuccess: (res) => {
      Alert.alert(
        'Reconciliação concluída',
        `DLQ drenada: ${res.dlqDrained}\nPagamentos presos retentados: ${res.stuckRetried}`
      );
      utils.admin.settlementStatus.invalidate();
      utils.admin.deadLetterQueue.invalidate();
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const refreshing = status.isRefetching || dlq.isRefetching;
  const onRefresh = () => {
    status.refetch();
    dlq.refetch();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Operações',
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {status.isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : status.data ? (
          <>
            <Text className="font-display text-lg font-bold text-ink mb-3">Escrow</Text>
            <View className="flex-row gap-3 mb-3">
              <StatCard label="Jobs agendados" value={status.data.pendingJobs} />
              <StatCard
                label="Dead-letter (DLQ)"
                value={status.data.deadLetterCount}
                warn={status.data.deadLetterCount > 0}
              />
            </View>
            <View className="flex-row gap-3 mb-6">
              <StatCard label="Pagamentos retidos" value={status.data.heldPayments} />
              <StatCard
                label="Em disputa"
                value={status.data.disputedPayments}
                warn={status.data.disputedPayments > 0}
              />
            </View>

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Rodar reconciliação?',
                  'Vai drenar a DLQ e retentar pagamentos presos. É seguro (idempotente).',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Rodar', onPress: () => reconcile.mutate() },
                  ]
                )
              }
              disabled={reconcile.isPending}
              className="bg-accent py-4 rounded-button items-center flex-row justify-center mb-8"
            >
              {reconcile.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={20} color="#fff" />
                  <Text className="text-white font-bold ml-2">Rodar reconciliação</Text>
                </>
              )}
            </Pressable>

            {/* DLQ contents */}
            <Text className="font-display text-lg font-bold text-ink mb-3">
              Dead-letter queue
            </Text>
            {dlq.data && dlq.data.length > 0 ? (
              dlq.data.map((job, i) => (
                <View
                  key={i}
                  className="bg-surface rounded-card border border-danger/20 p-3 mb-2"
                >
                  <Text className="text-ink-soft text-xs" numberOfLines={3}>
                    {JSON.stringify(job)}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-ink-muted text-sm">Nenhum job na DLQ 🎉</Text>
            )}
          </>
        ) : (
          <Text className="text-danger">{status.error?.message}</Text>
        )}
      </ScrollView>
    </>
  );
}
