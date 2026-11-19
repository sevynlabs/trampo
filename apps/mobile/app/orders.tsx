import { useState } from 'react';
import { View, Text, FlatList, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../src/lib/trpc';
import { formatCurrency } from '../src/lib/format';
import { SkeletonCard } from '../src/components/Skeleton';
import { EmptyState, EmptyTasksIllustration } from '../src/components/illustrations';
import { ScreenHeader, Chip, TaskRow, Button, colors } from '../src/components/ds';

const FILTERS = [
  { key: 'active', label: 'Em aberto', statuses: ['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'] },
  { key: 'done', label: 'Finalizados', statuses: ['RELEASED'] },
  { key: 'cancelled', label: 'Cancelados', statuses: ['CANCELLED'] },
] as const;

/** "Meus pedidos" (client). */
export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('active');
  const { data, isLoading, refetch, isRefetching } = trpc.tasks.listMine.useQuery();
  const statuses: readonly string[] = FILTERS.find((f) => f.key === filter)!.statuses;
  const list = (data ?? []).filter((t) => statuses.includes(t.status));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Meus pedidos" paddingTop={insets.top} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>
      {isLoading ? (
        <View style={{ paddingHorizontal: 20 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} index={i} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          renderItem={({ item }) => (
            <TaskRow
              title={item.title}
              category={item.category.name}
              categorySlug={item.category.slug}
              subtitle={item.assignment?.tasker?.name ? `com ${item.assignment.tasker.name}` : item.category.name}
              value={formatCurrency(item.totalValue)}
              status={item.status}
              onPress={() => router.push(`/task/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState illustration={EmptyTasksIllustration} title="Nada por aqui" subtitle="Seus pedidos aparecem nesta lista.">
              <Button label="Publicar pedido" icon="add" onPress={() => router.push('/task/create')} />
            </EmptyState>
          }
        />
      )}
    </View>
  );
}
