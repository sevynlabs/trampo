import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';
import { EmptyState, EmptyTasksIllustration } from '../../src/components/illustrations';
import { PressableCard } from '../../src/components/PressableCard';
import { SkeletonCard } from '../../src/components/Skeleton';

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function FeedScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationError, setLocationError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const { data: me } = trpc.profiles.getMe.useQuery();
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: categories } = trpc.categories.list.useQuery();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'value'>('distance');

  const {
    data: tasks,
    refetch,
    isLoading,
    isError,
  } = trpc.feed.nearby.useQuery(
    {
      location: location!,
      // The tasker's configured service area (the server also caps it)
      radiusMeters: me?.taskerProfile?.serviceRadius ?? 10000,
      categoryId: selectedCategory,
      limit: 50,
    },
    { enabled: !!location }
  );

  const loadLocation = useCallback(async () => {
    setLocationError('');
    setPermissionDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLocationError('Precisamos da sua localização para mostrar serviços próximos.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      // e.g. location services turned off
      setLocationError('Não conseguimos obter sua localização. Verifique se o GPS está ligado.');
    }
  }, []);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const visibleTasks = useMemo(() => {
    let list = tasks?.tasks ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q) ||
          t.category.name.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      sortBy === 'value'
        ? b.taskerValue - a.taskerValue
        : (a.distance ?? 0) - (b.distance ?? 0)
    );
  }, [tasks, search, sortBy]);

  if (locationError) {
    return (
      <View style={styles.errorContainer}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.errorContent}>
          <View style={styles.errorIcon}>
            <Ionicons name="location-outline" size={48} color="#5F6B7E" />
          </View>
          <Text style={styles.errorTitle}>Localização necessária</Text>
          <Text style={styles.errorText}>{locationError}</Text>
          <Pressable
            onPress={() => (permissionDenied ? Linking.openSettings() : loadLocation())}
            accessibilityRole="button"
            style={styles.locationAction}
          >
            <Text style={styles.locationActionText}>
              {permissionDenied ? 'Abrir configurações' : 'Tentar novamente'}
            </Text>
          </Pressable>
          {permissionDenied && (
            <Pressable onPress={loadLocation} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.locationRetryText}>Já permiti, tentar de novo</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingPulse}>
            <Ionicons name="navigate" size={32} color="#FF6A00" />
          </View>
          <Text style={styles.loadingText}>Obtendo localização...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#EEF3F9', '#F5F8FC']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.Text
          entering={FadeIn.duration(300)}
          style={styles.headerTitle}
        >
          Novas solicitações
        </Animated.Text>

        {/* Search */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(420)}
          style={[
            styles.searchContainer,
            searchFocused && styles.searchContainerFocused,
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={searchFocused ? '#FF6A00' : '#5F6B7E'}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por título, bairro ou categoria"
            placeholderTextColor="#9AA5B8"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#9AA5B8" />
            </Pressable>
          )}
        </Animated.View>

        {/* Sort */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(420)}
          style={styles.sortRow}
        >
          <Text style={styles.sortLabel}>Ordenar:</Text>
          {(['distance', 'value'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => setSortBy(key)}
              style={[
                styles.sortChip,
                sortBy === key && styles.sortChipActive,
              ]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortBy === key && styles.sortChipTextActive,
                ]}
              >
                {key === 'distance' ? 'Mais perto' : 'Maior valor'}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Category filter */}
        <Animated.View entering={FadeInDown.delay(300).duration(420)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            <Pressable
              onPress={() => setSelectedCategory(undefined)}
              style={[
                styles.categoryChip,
                !selectedCategory && styles.categoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  !selectedCategory && styles.categoryChipTextActive,
                ]}
              >
                Todos
              </Text>
            </Pressable>
            {categories?.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat.id && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </View>
        ) : isError ? (
          <EmptyState
            illustration={EmptyTasksIllustration}
            title="Não foi possível carregar"
            subtitle="Verifique sua conexão e puxe a tela para atualizar."
          />
        ) : !visibleTasks.length ? (
          <EmptyState
            illustration={EmptyTasksIllustration}
            title={search ? 'Nada encontrado' : 'Nenhum trampo por perto'}
            subtitle={
              search
                ? `Nenhum trampo combina com "${search}". Tente outra busca.`
                : 'Não há serviços disponíveis na sua região agora. Tente de novo mais tarde.'
            }
          />
        ) : (
          <View style={styles.taskList}>
            {visibleTasks.map((task, i) => (
              <PressableCard
                key={task.id}
                index={i}
                variant={task.isUrgent ? 'urgent' : 'default'}
                onPress={() => router.push(`/task/${task.id}`)}
              >
                <View style={styles.taskHeader}>
                  <View style={styles.taskHeaderLeft}>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={styles.taskCategory}>{task.category.name}</Text>
                  </View>
                  {task.isUrgent && (
                    <View style={styles.urgentBadge}>
                      <Ionicons name="flash" size={12} color="#ffffff" />
                      <Text style={styles.urgentText}>Urgente</Text>
                    </View>
                  )}
                </View>

                <View style={styles.taskLocation}>
                  <Ionicons name="location-outline" size={14} color="#5F6B7E" />
                  <Text style={styles.taskAddress} numberOfLines={1}>
                    {task.address}
                  </Text>
                  {task.distance != null && (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>
                        {formatDistance(task.distance)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.taskFooter}>
                  <View style={styles.clientInfo}>
                    <View style={styles.clientAvatar}>
                      <Text style={styles.clientInitial}>
                        {task.clientName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.clientName}>
                      {task.clientName.split(' ')[0]}
                    </Text>
                  </View>
                  <Text style={styles.taskValue}>
                    {formatCurrency(task.taskerValue)}
                  </Text>
                </View>
              </PressableCard>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  locationAction: {
    marginTop: 20,
    backgroundColor: '#FF6A00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  locationActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  locationRetryText: {
    color: '#FF6A00',
    fontWeight: '600',
    marginTop: 16,
    paddingVertical: 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EBF2',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#041E42',
    letterSpacing: -0.5,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E6EBF2',
    marginBottom: 12,
  },
  searchContainerFocused: {
    borderColor: '#FF6A00',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#041E42',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
    gap: 8,
  },
  sortLabel: {
    fontSize: 13,
    color: '#5F6B7E',
    marginRight: 4,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },
  sortChipActive: {
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    borderColor: '#FF6A00',
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5F6B7E',
  },
  sortChipTextActive: {
    color: '#FF6A00',
  },
  categoriesContainer: {
    paddingHorizontal: 24,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEF3F9',
  },
  categoryChipActive: {
    backgroundColor: '#FF6A00',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5F6B7E',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  skeletonContainer: {
    gap: 12,
  },
  taskList: {
    gap: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  taskHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#041E42',
    marginBottom: 2,
  },
  taskCategory: {
    fontSize: 13,
    color: '#5F6B7E',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  urgentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  taskLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskAddress: {
    flex: 1,
    fontSize: 14,
    color: '#5F6B7E',
    marginLeft: 4,
  },
  distanceBadge: {
    backgroundColor: '#EEF3F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0B2E5C',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF3F9',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFC59E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  clientInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  clientName: {
    fontSize: 14,
    color: '#5F6B7E',
  },
  taskValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0E9F6E',
  },
  // Error and Loading states
  errorContainer: {
    flex: 1,
    backgroundColor: '#F5F8FC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorContent: {
    alignItems: 'center',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#041E42',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#5F6B7E',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F8FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingPulse: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#5F6B7E',
  },
});
