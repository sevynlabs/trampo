import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '../../src/lib/trpc';

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}

function memberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: profile, isLoading } = trpc.profiles.getPublic.useQuery({ userId: id! });
  const { data: reviewsData } = trpc.reviews.listForUser.useQuery({ userId: id! });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Perfil',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      {isLoading || !profile ? (
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator size="large" color="#018ABE" />
        </View>
      ) : (
        <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View className="bg-surface items-center pt-8 pb-6 px-6 border-b border-border">
            <LinearGradient
              colors={['#001B48', '#018ABE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 88,
                height: 88,
                borderRadius: 9999,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Text className="font-display text-3xl text-white font-bold">
                {profile.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </LinearGradient>

            <View className="flex-row items-center">
              <Text className="font-display text-xl font-bold text-ink">
                {profile.name || 'Usuário'}
              </Text>
              {profile.kycVerified && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#018ABE"
                  style={{ marginLeft: 6 }}
                />
              )}
            </View>

            {profile.isTasker && profile.totalTasks > 0 && (
              <View className="flex-row items-center mt-2">
                <Stars rating={profile.rating} size={16} />
                <Text className="text-ink-soft font-medium ml-2">
                  {profile.rating.toFixed(1)}
                </Text>
                <Text className="text-ink-muted ml-1">
                  · {profile.totalTasks} {profile.totalTasks === 1 ? 'trampo' : 'trampos'}
                </Text>
              </View>
            )}

            <Text className="text-ink-faint text-sm mt-2">
              No TRAMPO desde {memberSince(profile.memberSince)}
            </Text>

            {profile.bio ? (
              <Text className="text-ink-soft text-center mt-3">{profile.bio}</Text>
            ) : null}
          </View>

          {/* Reviews */}
          <View className="p-6">
            <Text className="font-display text-lg font-bold text-ink mb-4">
              Avaliações {reviewsData ? `(${reviewsData.total})` : ''}
            </Text>

            {!reviewsData?.reviews?.length ? (
              <Text className="text-ink-muted">Ainda não há avaliações.</Text>
            ) : (
              reviewsData.reviews.map((r) => (
                <View
                  key={r.id}
                  className="bg-surface rounded-card border border-border p-4 mb-3"
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="font-bold text-ink">{r.reviewer.name ?? 'Usuário'}</Text>
                    <Stars rating={r.rating} />
                  </View>
                  <Text className="text-ink-faint text-xs mb-2">{r.task.title}</Text>
                  {r.comment ? (
                    <Text className="text-ink-soft text-sm leading-5">{r.comment}</Text>
                  ) : null}
                  {r.tags && r.tags.length > 0 && (
                    <View className="flex-row flex-wrap gap-2 mt-3">
                      {r.tags.map((tag) => (
                        <View key={tag} className="bg-accent/10 px-3 py-1 rounded-chip">
                          <Text className="text-accent text-xs font-medium">{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </>
  );
}
