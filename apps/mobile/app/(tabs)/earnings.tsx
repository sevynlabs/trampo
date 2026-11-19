import { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';
import { EmptyState, EmptyEarningsIllustration } from '../../src/components/illustrations';
import { Card, Button, IconCircle, colors } from '../../src/components/ds';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Meus ganhos": month summary + 6-month chart, balances and history. */
export default function EarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: earnings, refetch, isLoading, isError } = trpc.payments.listForTasker.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const available = earnings?.available || 0;
  const held = earnings?.held || 0;
  const thisMonth = earnings?.thisMonth || 0;
  const payments = earnings?.payments ?? [];
  const releasedTotal = payments.filter((p) => p.status === 'RELEASED').reduce((s, p) => s + p.amount, 0);

  // Last 6 months of released earnings (from the recent history list)
  const now = new Date();
  const bars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const total = payments
      .filter((p) => p.status === 'RELEASED' && p.releasedAt)
      .filter((p) => {
        const r = new Date(p.releasedAt!);
        return r.getFullYear() === d.getFullYear() && r.getMonth() === d.getMonth();
      })
      .reduce((s, p) => s + p.amount, 0);
    return { label: MONTHS[d.getMonth()], total };
  });
  const max = Math.max(1, ...bars.map((b) => b.total));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <Text style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8, fontSize: 24, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
        Meus ganhos
      </Text>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {isError && (
          <Pressable onPress={() => refetch()} accessibilityRole="button" style={{ backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={{ color: colors.danger, marginLeft: 8, flex: 1 }}>Não foi possível carregar seus ganhos. Toque para tentar novamente.</Text>
          </Pressable>
        )}

        {/* Month summary + chart */}
        <Card>
          <Text style={{ fontSize: 13, color: colors.inkMuted }}>Resumo do mês</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.orange} style={{ alignSelf: 'flex-start', marginVertical: 10 }} />
          ) : (
            <Text style={{ fontSize: 30, fontWeight: '900', color: colors.ink, marginTop: 2 }}>{isError ? '--' : formatCurrency(thisMonth)}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, marginTop: 14, gap: 10 }}>
            {bars.map((b, i) => (
              <View key={b.label + i} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: '70%',
                    height: Math.max(6, (b.total / max) * 70),
                    borderRadius: 6,
                    backgroundColor: i === bars.length - 1 ? colors.sky : '#BFE6F6',
                  }}
                />
                <Text style={{ fontSize: 11, color: colors.inkMuted, marginTop: 4 }}>{b.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Balances */}
        <Card style={{ marginTop: 14, paddingVertical: 6 }}>
          <BalanceRow icon="checkmark-circle-outline" color={colors.success} label="Serviços concluídos" value={formatCurrency(releasedTotal)} />
          <BalanceRow icon="time-outline" color={colors.orange} label="Em processamento" value={formatCurrency(held)} hint="Liberado 1h após a conclusão" />
          <BalanceRow icon="wallet-outline" color={colors.sky} label="Disponível para saque" value={formatCurrency(available)} strong />
        </Card>

        <Button label="Solicitar saque" icon="cash-outline" onPress={() => router.push('/withdraw')} disabled={!isLoading && available <= 0} style={{ marginTop: 16 }} />

        {/* History */}
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 26, marginBottom: 12 }}>Histórico</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.orange} style={{ marginTop: 24 }} />
        ) : isError ? null : payments.length === 0 ? (
          <EmptyState illustration={EmptyEarningsIllustration} title="Sem ganhos ainda" subtitle="Conclua serviços para ver seus pagamentos aparecerem aqui." />
        ) : (
          <Card padded={false}>
            {payments.map((tx, i) => (
              <Animated.View key={tx.id} entering={FadeInDown.delay(Math.min(i, 8) * 50).duration(380)}>
                <Pressable
                  onPress={() => router.push(`/task/${tx.taskId}`)}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.hairline }}
                >
                  <IconCircle
                    icon={tx.status === 'RELEASED' ? 'checkmark' : 'hourglass-outline'}
                    size={40}
                    color={tx.status === 'RELEASED' ? colors.success : colors.orange}
                    bg={tx.status === 'RELEASED' ? colors.successSoft : colors.orangeTint}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '700', color: colors.ink }}>{tx.taskTitle}</Text>
                    <Text style={{ fontSize: 12.5, color: colors.inkMuted }}>
                      {tx.clientName ? `${tx.clientName} · ` : ''}
                      {tx.completedAt ? new Date(tx.completedAt).toLocaleDateString('pt-BR') : '-'}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: tx.status === 'RELEASED' ? colors.success : colors.inkMuted }}>+{formatCurrency(tx.amount)}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function BalanceRow({
  icon,
  color,
  label,
  value,
  hint,
  strong,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 14.5, color: colors.ink, fontWeight: strong ? '700' : '500' }}>{label}</Text>
        {hint && <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>{hint}</Text>}
      </View>
      <Text style={{ fontSize: strong ? 16 : 14.5, fontWeight: '800', color: colors.ink }}>{value}</Text>
    </View>
  );
}
