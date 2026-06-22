import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../src/lib/trpc';
import { useState } from 'react';
import { formatCurrency } from '../../src/lib/format';
import { EmptyState, EmptyEarningsIllustration } from '../../src/components/illustrations';

export default function EarningsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: earnings, refetch } = trpc.payments.listForTasker.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const available = earnings?.available || 0;
  const held = earnings?.held || 0;
  const thisMonth = earnings?.thisMonth || 0;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-accent px-6 pt-16 pb-8">
        <Text className="text-white/80 text-sm mb-1">Saldo disponível</Text>
        <Text className="font-display text-4xl font-bold text-white">
          {formatCurrency(available)}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats cards */}
        <View className="flex-row gap-3 mb-8">
          <View className="flex-1 bg-surface rounded-card p-4 border border-border">
            <View className="flex-row items-center mb-2">
              <Ionicons name="hourglass-outline" size={20} color="#018ABE" />
              <Text className="text-ink-muted text-sm ml-2">Em espera</Text>
            </View>
            <Text className="font-bold text-xl text-ink">
              {formatCurrency(held)}
            </Text>
            <Text className="text-ink-faint text-xs mt-1">
              Liberados em até 1h após conclusão
            </Text>
          </View>

          <View className="flex-1 bg-surface rounded-card p-4 border border-border">
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={20} color="#0E9F6E" />
              <Text className="text-ink-muted text-sm ml-2">Este mês</Text>
            </View>
            <Text className="font-bold text-xl text-ink">
              {formatCurrency(thisMonth)}
            </Text>
            <Text className="text-ink-faint text-xs mt-1">
              Total ganho no mês
            </Text>
          </View>
        </View>

        {/* Withdraw button */}
        <View className="bg-surface rounded-card p-4 border border-border mb-8">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-bold text-ink">Sacar dinheiro</Text>
              <Text className="text-ink-muted text-sm mt-1">
                Transferência via Pix instantâneo
              </Text>
            </View>
            <View className="bg-accent p-3 rounded-button">
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </View>
          </View>
        </View>

        {/* Recent transactions */}
        <Text className="font-display text-lg font-bold text-ink mb-4">
          Histórico
        </Text>

        {!earnings?.payments?.length ? (
          <EmptyState
            illustration={EmptyEarningsIllustration}
            title="Sem ganhos ainda"
            subtitle="Conclua trampos para ver seus pagamentos aparecerem aqui."
          />
        ) : (
          <View className="bg-surface rounded-card border border-border overflow-hidden">
            {
            earnings.payments.map((tx, i) => (
              <View
                key={tx.id}
                className={`flex-row items-center p-4 ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    tx.status === 'RELEASED' ? 'bg-success/10' : 'bg-warning/10'
                  }`}
                >
                  <Ionicons
                    name={tx.status === 'RELEASED' ? 'checkmark' : 'hourglass'}
                    size={20}
                    color={tx.status === 'RELEASED' ? '#0E9F6E' : '#018ABE'}
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-ink font-medium">{tx.taskTitle}</Text>
                  <Text className="text-ink-faint text-sm">
                    {tx.completedAt
                      ? new Date(tx.completedAt).toLocaleDateString('pt-BR')
                      : '-'}
                  </Text>
                </View>
                <Text
                  className={`font-bold ${
                    tx.status === 'RELEASED' ? 'text-success' : 'text-warning'
                  }`}
                >
                  +{formatCurrency(tx.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
