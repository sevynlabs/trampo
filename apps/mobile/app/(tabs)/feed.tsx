import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { trpc } from '../../src/lib/trpc';
import { formatCurrency } from '../../src/lib/format';
import { EmptyState, EmptyTasksIllustration } from '../../src/components/illustrations';

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

  const { data: categories } = trpc.categories.list.useQuery();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const {
    data: tasks,
    refetch,
    isLoading,
  } = trpc.feed.nearby.useQuery(
    {
      location: location!,
      radiusMeters: 15000,
      categoryId: selectedCategory,
      limit: 50,
    },
    { enabled: !!location }
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Precisamos da sua localização para mostrar serviços próximos');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (locationError) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Ionicons name="location-outline" size={64} color="#94B2C4" />
        <Text className="text-ink font-bold text-lg mt-4 text-center">
          Localização necessária
        </Text>
        <Text className="text-ink-muted text-center mt-2">{locationError}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#018ABE" />
        <Text className="text-ink-muted mt-4">Obtendo localização...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-surface px-6 pt-16 pb-4 border-b border-border">
        <Text className="font-display text-2xl font-bold text-ink mb-4">
          Serviços próximos
        </Text>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Pressable
            onPress={() => setSelectedCategory(undefined)}
            className={`px-4 py-2 rounded-chip ${
              !selectedCategory ? 'bg-accent' : 'bg-border'
            }`}
          >
            <Text
              className={`font-medium ${
                !selectedCategory ? 'text-white' : 'text-ink-soft'
              }`}
            >
              Todos
            </Text>
          </Pressable>
          {categories?.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-chip ${
                selectedCategory === cat.id ? 'bg-accent' : 'bg-border'
              }`}
            >
              <Text
                className={`font-medium ${
                  selectedCategory === cat.id ? 'text-white' : 'text-ink-soft'
                }`}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#018ABE" />
          </View>
        ) : !tasks?.tasks?.length ? (
          <EmptyState
            illustration={EmptyTasksIllustration}
            title="Nenhum trampo por perto"
            subtitle="Não há serviços disponíveis na sua região agora. Tente de novo mais tarde."
          />
        ) : (
          <View className="gap-3">
            {tasks.tasks.map((task) => (
              <Pressable
                key={task.id}
                onPress={() => router.push(`/task/${task.id}`)}
                className="bg-surface rounded-card p-4 border border-border"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="font-bold text-ink">{task.title}</Text>
                    <Text className="text-ink-muted text-sm mt-1">
                      {task.category.name}
                    </Text>
                  </View>
                  {task.isUrgent && (
                    <View className="bg-warning px-2 py-1 rounded-chip">
                      <Text className="text-white text-xs font-medium">
                        Urgente
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center mt-2 mb-3">
                  <Ionicons name="location-outline" size={14} color="#5B7A91" />
                  <Text className="text-ink-muted text-sm ml-1 flex-1" numberOfLines={1}>
                    {task.address}
                  </Text>
                  {task.distance && (
                    <Text className="text-ink-soft text-sm font-medium">
                      {formatDistance(task.distance)}
                    </Text>
                  )}
                </View>

                <View className="flex-row justify-between items-center pt-3 border-t border-border">
                  <Text className="text-ink-soft text-sm">
                    {task.clientName.split(' ')[0]}
                  </Text>
                  <Text className="font-bold text-success text-lg">
                    {formatCurrency(task.taskerValue)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
