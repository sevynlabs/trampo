import { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../src/lib/trpc';
import { SkeletonCard } from '../../src/components/Skeleton';
import { EmptyState, EmptyTasksIllustration } from '../../src/components/illustrations';
import { SearchBar, Chip, ProfessionalCard, Button, colors } from '../../src/components/ds';

type Sort = 'rating' | 'experience' | 'recent';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'rating', label: 'Melhor avaliados' },
  { value: 'experience', label: 'Mais experientes' },
  { value: 'recent', label: 'Novos na plataforma' },
];

/** "Buscar serviços": professionals directory with text, category and sort filters. */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ categoryId?: string; filters?: string }>();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(params.categoryId);
  const [sort, setSort] = useState<Sort>('rating');
  const [showSort, setShowSort] = useState(params.filters === '1');

  useEffect(() => {
    if (params.categoryId) setCategoryId(params.categoryId);
    if (params.filters === '1') setShowSort(true);
  }, [params.categoryId, params.filters]);

  // Debounce typing
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const { data: categories } = trpc.categories.list.useQuery();
  const list = trpc.profiles.listTaskers.useQuery({ categoryId, query: query || undefined, sort, limit: 30 });

  const hire = (catId?: string) =>
    router.push({ pathname: '/task/create', params: catId ? { categoryId: catId } : {} });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink, letterSpacing: -0.5, marginBottom: 14 }}>Buscar serviços</Text>
        <SearchBar
          value={text}
          onChangeText={setText}
          placeholder="Ex.: eletricista, pedreiro..."
          onFilter={() => setShowSort((s) => !s)}
          autoCorrect={false}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14 }}>
        <Chip label="Todos" active={!categoryId} onPress={() => setCategoryId(undefined)} />
        {(categories ?? []).map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>

      {showSort && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          {SORTS.map((s) => (
            <Chip key={s.value} label={s.label} icon="swap-vertical" active={sort === s.value} onPress={() => setSort(s.value)} />
          ))}
        </ScrollView>
      )}

      {list.isLoading ? (
        <View style={{ paddingHorizontal: 20 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} index={i} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={list.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
          ListHeaderComponent={
            (list.data?.length ?? 0) > 0 ? (
              <Text style={{ fontSize: 13, color: colors.inkMuted, marginBottom: 10 }}>
                {list.data!.length} {list.data!.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ProfessionalCard
              pro={item}
              onPress={() => router.push(`/user/${item.id}`)}
              onHire={() => hire(categoryId ?? item.categories[0]?.id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              illustration={EmptyTasksIllustration}
              title={list.isError ? 'Não foi possível buscar' : 'Nenhum profissional encontrado'}
              subtitle={
                list.isError
                  ? 'Verifique sua conexão e tente novamente.'
                  : 'Publique seu pedido e os profissionais da categoria serão avisados.'
              }
            >
              {list.isError ? (
                <Button label="Tentar novamente" variant="outline" onPress={() => list.refetch()} />
              ) : (
                <Button label="Publicar pedido" icon="add" onPress={() => hire(categoryId)} />
              )}
            </EmptyState>
          }
        />
      )}
    </View>
  );
}
