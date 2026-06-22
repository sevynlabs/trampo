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

// Preset radii in meters (API accepts 1000–50000).
const RADIUS_OPTIONS = [
  { meters: 2000, label: '2 km', description: 'Apenas pertinho' },
  { meters: 5000, label: '5 km', description: 'Bairros vizinhos' },
  { meters: 10000, label: '10 km', description: 'Cidade toda' },
  { meters: 20000, label: '20 km', description: 'Cidade e arredores' },
  { meters: 50000, label: '50 km', description: 'Cidades próximas' },
];

export default function ServiceAreaScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: user, isLoading } = trpc.profiles.getMe.useQuery();
  const [radius, setRadius] = useState<number | null>(null);

  // Prefill from the tasker's current service radius.
  useEffect(() => {
    if (user?.taskerProfile) {
      setRadius(user.taskerProfile.serviceRadius);
    }
  }, [user]);

  const save = trpc.profiles.updateRadius.useMutation({
    onSuccess: () => {
      utils.profiles.getMe.invalidate();
      Alert.alert('Pronto', 'Área de atuação atualizada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Área de atuação',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#18181B" />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <View className="flex-1 bg-background">
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 24 }}>
            <Text className="text-ink-muted mb-6">
              Defina a distância máxima dos trampos que você quer receber a partir da sua
              localização.
            </Text>

            <View className="gap-3">
              {RADIUS_OPTIONS.map((opt) => {
                const isSelected = radius === opt.meters;
                return (
                  <Pressable
                    key={opt.meters}
                    onPress={() => setRadius(opt.meters)}
                    className={`flex-row items-center p-4 rounded-card border-2 ${
                      isSelected
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <Ionicons
                      name="location"
                      size={22}
                      color={isSelected ? '#EA580C' : '#A1A1AA'}
                    />
                    <View className="flex-1 ml-3">
                      <Text
                        className={`font-bold text-base ${
                          isSelected ? 'text-accent' : 'text-ink'
                        }`}
                      >
                        {opt.label}
                      </Text>
                      <Text className="text-ink-muted text-sm">{opt.description}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#EA580C" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Save bar */}
          <View className="bg-surface border-t border-border p-4 pb-8">
            <Pressable
              onPress={() => radius && save.mutate({ radiusMeters: radius })}
              disabled={save.isPending || !radius}
              className={`py-4 rounded-button items-center ${
                radius ? 'bg-accent' : 'bg-border'
              }`}
            >
              {save.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-lg">Salvar</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}
