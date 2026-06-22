import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../src/lib/trpc';

export default function ServiceCategoriesScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: categories, isLoading } = trpc.categories.list.useQuery();
  const { data: user } = trpc.profiles.getMe.useQuery();

  const [selected, setSelected] = useState<string[]>([]);

  // Prefill from the tasker's current categories.
  useEffect(() => {
    if (user?.taskerProfile?.categories) {
      setSelected(user.taskerProfile.categories.map((c) => c.categoryId));
    }
  }, [user]);

  const save = trpc.profiles.updateCategories.useMutation({
    onSuccess: () => {
      utils.profiles.getMe.invalidate();
      Alert.alert('Pronto', 'Categorias atualizadas.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Categorias de serviço',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator size="large" color="#018ABE" />
        </View>
      ) : (
        <View className="flex-1 bg-background">
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 24 }}>
            <Text className="text-ink-muted mb-6">
              Selecione os tipos de serviço que você quer oferecer. Você só verá trampos
              dessas categorias no feed.
            </Text>

            <View className="flex-row flex-wrap gap-3">
              {categories?.map((cat) => {
                const isSelected = selected.includes(cat.id);
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => toggle(cat.id)}
                    className={`flex-row items-center px-4 py-3 rounded-card border-2 ${
                      isSelected
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {cat.icon ? (
                      <Text className="mr-2">{cat.icon}</Text>
                    ) : null}
                    <Text
                      className={`font-medium ${
                        isSelected ? 'text-accent' : 'text-ink'
                      }`}
                    >
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#018ABE"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Save bar */}
          <View className="bg-surface border-t border-border p-4 pb-8">
            <Pressable
              onPress={() => save.mutate({ categoryIds: selected })}
              disabled={save.isPending}
              className="bg-accent py-4 rounded-button items-center"
            >
              {save.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-lg">
                  Salvar {selected.length > 0 ? `(${selected.length})` : ''}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}
