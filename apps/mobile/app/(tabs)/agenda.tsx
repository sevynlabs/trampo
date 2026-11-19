import { View, Text, SectionList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';
import { SkeletonCard } from '../../src/components/Skeleton';
import { EmptyState, AllClearIllustration } from '../../src/components/illustrations';
import { TaskRow, Button, colors } from '../../src/components/ds';

const ACTIVE = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'];

function dayLabel(d: Date | null) {
  if (!d) return 'Sem data definida';
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const date = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  if (d.toDateString() === today.toDateString()) return `Hoje, ${date}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Amanhã, ${date}`;
  return date.charAt(0).toUpperCase() + date.slice(1);
}

/** Professional agenda: accepted jobs grouped by scheduled day. */
export default function AgendaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = trpc.tasks.listAssigned.useQuery();

  const active = (data ?? []).filter((t) => ACTIVE.includes(t.status));
  const groups = new Map<string, { title: string; ts: number; data: typeof active }>();
  for (const t of active) {
    const d = t.scheduledAt ? new Date(t.scheduledAt) : null;
    const key = d ? d.toDateString() : 'none';
    if (!groups.has(key)) groups.set(key, { title: dayLabel(d), ts: d ? d.getTime() : Number.MAX_SAFE_INTEGER, data: [] });
    groups.get(key)!.data.push(t);
  }
  const sections = [...groups.values()].sort((a, b) => a.ts - b.ts);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <Text style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 4, fontSize: 24, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
        Agenda
      </Text>
      <Text style={{ paddingHorizontal: 20, fontSize: 14, color: colors.inkMuted, marginBottom: 8 }}>Seus serviços confirmados</Text>
      {isLoading ? (
        <View style={{ padding: 20 }}>
          {[0, 1].map((i) => (
            <SkeletonCard key={i} index={i} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          renderSectionHeader={({ section }) => (
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 14, marginBottom: 8 }}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <TaskRow
              title={item.title}
              category={item.category.name}
              categorySlug={item.category.slug}
              subtitle={`${item.scheduledAt ? new Date(item.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · ' : ''}${item.address}`}
              value={formatCurrency(item.taskerValue)}
              status={item.status}
              onPress={() => router.push(`/task/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState illustration={AllClearIllustration} title="Agenda livre" subtitle="Aceite solicitações para preencher sua agenda.">
              <Button label="Ver solicitações" onPress={() => router.push('/(tabs)/feed')} />
            </EmptyState>
          }
        />
      )}
    </View>
  );
}
