import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { trpc } from '../../src/lib/trpc';
import { GradientButton } from '../../src/components/GradientButton';
import { toUF } from '../../src/lib/brazil';

// Preset radii in meters (API accepts 1000–50000).
const RADIUS_OPTIONS = [
  { meters: 2000, label: '2 km', description: 'Apenas pertinho' },
  { meters: 5000, label: '5 km', description: 'Bairros vizinhos' },
  { meters: 10000, label: '10 km', description: 'Cidade toda' },
  { meters: 20000, label: '20 km', description: 'Cidade e arredores' },
  { meters: 50000, label: '50 km', description: 'Cidades próximas' },
];

type Base = { latitude: number; longitude: number; city?: string; state?: string };
type LocStatus = 'idle' | 'loading' | 'denied' | 'failed';

export default function ServiceAreaScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: user, isLoading } = trpc.profiles.getMe.useQuery();
  const [radius, setRadius] = useState<number | null>(null);
  const [base, setBase] = useState<Base | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>('idle');

  const savedCity = user?.taskerProfile?.city ?? null;
  const savedState = user?.taskerProfile?.state ?? null;

  // Prefill from the tasker's current service radius.
  useEffect(() => {
    if (user?.taskerProfile) {
      setRadius(user.taskerProfile.serviceRadius);
    }
  }, [user]);

  /** GPS → city/UF (the base used for the feed and shown in the admin). */
  const detectLocation = useCallback(async () => {
    setLocStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      let city: string | undefined;
      let state: string | undefined;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        city = place?.city ?? place?.subregion ?? place?.district ?? undefined;
        state = toUF(place?.region) ?? undefined;
      } catch {
        // Geocoding can fail offline; the coordinates are still saved.
      }
      setBase({ latitude, longitude, city: city || undefined, state });
      setLocStatus('idle');
    } catch {
      setLocStatus('failed');
    }
  }, []);

  // First time (no saved city): try to detect automatically.
  useEffect(() => {
    if (!isLoading && user?.taskerProfile && !savedCity && !base && locStatus === 'idle') {
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user?.taskerProfile, savedCity]);

  const save = trpc.profiles.updateRadius.useMutation({
    onSuccess: () => {
      utils.profiles.getMe.invalidate();
      Alert.alert('Pronto', 'Área de atuação atualizada.', [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const handleSave = () => {
    if (!radius) return;
    save.mutate({
      radiusMeters: radius,
      ...(base
        ? {
            location: { latitude: base.latitude, longitude: base.longitude },
            ...(base.city ? { city: base.city } : {}),
            ...(base.state ? { state: base.state } : {}),
          }
        : {}),
    });
  };

  const shownCity = base?.city ?? savedCity;
  const shownState = base ? base.state : savedState;
  const label = shownCity ? `${shownCity}${shownState ? `, ${shownState}` : ''}` : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Área de atuação',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator size="large" color="#FF6A00" />
        </View>
      ) : (
        <View className="flex-1 bg-background">
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 24 }}>
            {/* Base location */}
            <Text className="text-ink font-bold text-lg mb-2">Sua base</Text>
            <View className="bg-surface border border-border rounded-card p-4 mb-6">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-accent/10 items-center justify-center">
                  <Ionicons name="navigate" size={20} color="#FF6A00" />
                </View>
                <View className="flex-1 ml-3">
                  {locStatus === 'loading' ? (
                    <Text className="text-ink-muted">Buscando sua localização…</Text>
                  ) : label ? (
                    <>
                      <Text className="text-ink font-bold text-base">{label}</Text>
                      <Text className="text-ink-muted text-xs mt-0.5">
                        {base ? 'Localização nova — toque em Salvar' : 'Clientes desta região veem você primeiro'}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-ink-muted">
                      {locStatus === 'denied'
                        ? 'Permita o acesso à localização para definir sua cidade.'
                        : locStatus === 'failed'
                          ? 'Não foi possível obter a localização.'
                          : 'Cidade ainda não definida.'}
                    </Text>
                  )}
                </View>
                {locStatus === 'loading' && <ActivityIndicator color="#FF6A00" />}
              </View>
              <Pressable
                onPress={detectLocation}
                disabled={locStatus === 'loading'}
                accessibilityRole="button"
                className="mt-3 flex-row items-center self-start"
              >
                <Ionicons name="locate-outline" size={16} color="#0096D6" />
                <Text className="ml-1.5 font-bold text-[#0096D6]">
                  {label ? 'Atualizar com minha localização atual' : 'Usar minha localização atual'}
                </Text>
              </Pressable>
            </View>

            <Text className="text-ink font-bold text-lg mb-2">Distância máxima</Text>
            <Text className="text-ink-muted mb-4">
              Até que distância da sua base você quer receber trampos.
            </Text>

            <View className="gap-3">
              {RADIUS_OPTIONS.map((opt) => {
                const isSelected = radius === opt.meters;
                return (
                  <Pressable
                    key={opt.meters}
                    onPress={() => setRadius(opt.meters)}
                    className={`flex-row items-center p-4 rounded-card border-2 ${
                      isSelected ? 'border-accent bg-accent/5' : 'border-border bg-surface'
                    }`}
                  >
                    <Ionicons name="location" size={22} color={isSelected ? '#FF6A00' : '#9AA5B8'} />
                    <View className="flex-1 ml-3">
                      <Text className={`font-bold text-base ${isSelected ? 'text-accent' : 'text-ink'}`}>{opt.label}</Text>
                      <Text className="text-ink-muted text-sm">{opt.description}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#FF6A00" />}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Save bar */}
          <View className="bg-surface border-t border-border p-4 pb-8">
            <GradientButton label="Salvar" onPress={handleSave} disabled={!radius} loading={save.isPending} />
          </View>
        </View>
      )}
    </>
  );
}
