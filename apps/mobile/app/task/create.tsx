import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
  StyleSheet,
  Linking,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { trpc } from '../../src/lib/trpc';
import { TASK_CONSTANTS } from '@trampo/contracts';
import { formatCurrency } from '../../src/lib/format';
import { GradientButton } from '../../src/components/GradientButton';
import { Input } from '../../src/components/Input';
import { categoryIcon } from '../../src/components/ds';

export default function CreateTaskScreen() {
  const router = useRouter();
  // Prefilled when coming from a professional / category ("Contratar")
  const params = useLocalSearchParams<{ categoryId?: string }>();

  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState('');
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ok' | 'denied' | 'failed'>(
    'loading'
  );

  const { data: categories } = trpc.categories.list.useQuery();
  const utils = trpc.useUtils();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: (data) => {
      utils.tasks.listMine.invalidate();
      router.replace(`/task/${data.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const loadLocation = async () => {
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setLocationStatus('ok');
    } catch {
      setLocationStatus('failed');
    }
  };

  useEffect(() => {
    loadLocation();
  }, []);

  const parsedValue = parseInt(baseValue.replace(/\D/g, '')) || 0;
  const isValidValue =
    parsedValue >= TASK_CONSTANTS.MIN_VALUE && parsedValue <= TASK_CONSTANTS.MAX_VALUE;

  const urgencyFee = isUrgent ? Math.round(parsedValue * TASK_CONSTANTS.URGENCY_FEE) : 0;
  const serviceFee = Math.round((parsedValue + urgencyFee) * TASK_CONSTANTS.CLIENT_FEE);
  const totalValue = parsedValue + urgencyFee + serviceFee;

  const isValid =
    categoryId &&
    title.length >= 5 &&
    address.length >= 5 &&
    isValidValue &&
    location;

  // Tell the user why "Publicar" is disabled
  const missingHint = !categoryId
    ? 'Escolha uma categoria'
    : title.length < 5
      ? 'O título precisa ter pelo menos 5 caracteres'
      : address.length < 5
        ? 'Informe o endereço'
        : !isValidValue
          ? parsedValue > TASK_CONSTANTS.MAX_VALUE
            ? 'O valor máximo é R$ 100.000,00'
            : 'O valor mínimo é R$ 50,00'
          : !location
            ? locationStatus === 'loading'
              ? 'Obtendo sua localização...'
              : 'Precisamos da sua localização para publicar'
            : null;

  const handleValueChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits === '') {
      setBaseValue('');
      return;
    }
    const value = parseInt(digits);
    setBaseValue(formatCurrency(value));
  };

  const handleSubmit = () => {
    if (!isValid || !location || !categoryId) return;
    setError('');

    createTask.mutate({
      categoryId,
      title,
      description: description || undefined,
      address,
      location,
      baseValue: parsedValue,
      isUrgent,
    });
  };

  const selectedCategory = categories?.find((c) => c.id === categoryId);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Contratar serviço',
          headerTitleStyle: { fontWeight: '800', color: '#041E42' },
          headerStyle: { backgroundColor: '#F5F8FC' },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category */}
          <Animated.View entering={FadeInDown.delay(100).duration(420)}>
            <Text style={styles.sectionLabel}>Categoria</Text>
            <View style={styles.categoryGrid}>
              {categories?.map((cat, index) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[
                    styles.categoryCard,
                    categoryId === cat.id && styles.categoryCardSelected,
                  ]}
                >
                  <Ionicons name={categoryIcon(cat)} size={24} color={categoryId === cat.id ? '#FF6A00' : '#041E42'} style={styles.categoryIcon} />
                  <Text
                    style={[
                      styles.categoryName,
                      categoryId === cat.id && styles.categoryNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                  {categoryId === cat.id && (
                    <View style={styles.categoryCheck}>
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(200).duration(420)}>
            <Input
              label="O que você precisa?"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              error={title.length > 0 && title.length < 5 ? 'Mínimo 5 caracteres' : undefined}
            />
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(300).duration(420)}>
            <Input
              label="Detalhes (opcional)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
          </Animated.View>

          {/* Address */}
          <Animated.View entering={FadeInDown.delay(400).duration(420)}>
            <Input
              label="Endereço"
              value={address}
              onChangeText={setAddress}
              icon="location-outline"
              maxLength={300}
              error={address.length > 0 && address.length < 5 ? 'Endereço muito curto' : undefined}
            />
          </Animated.View>

          {/* Value */}
          <Animated.View entering={FadeInDown.delay(500).duration(420)}>
            <Input
              label="Valor do serviço"
              value={baseValue}
              onChangeText={handleValueChange}
              keyboardType="number-pad"
              icon="cash-outline"
              error={
                baseValue && !isValidValue
                  ? `Valor mínimo: ${formatCurrency(TASK_CONSTANTS.MIN_VALUE)}`
                  : undefined
              }
            />
          </Animated.View>

          {/* Urgent toggle */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(420)}
            style={styles.urgentCard}
          >
            <View style={styles.urgentContent}>
              <View style={styles.urgentIconContainer}>
                <Ionicons name="flash" size={20} color="#F59E0B" />
              </View>
              <View style={styles.urgentText}>
                <Text style={styles.urgentTitle}>Urgente</Text>
                <Text style={styles.urgentDescription}>
                  +30% para serviços em até 1h
                </Text>
              </View>
            </View>
            <Switch
              value={isUrgent}
              onValueChange={setIsUrgent}
              trackColor={{ false: '#E6EBF2', true: '#FF6A00' }}
              thumbColor="#ffffff"
            />
          </Animated.View>

          {/* Price breakdown */}
          {isValidValue && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={styles.breakdownCard}
            >
              <Text style={styles.breakdownTitle}>Resumo</Text>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Valor base</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(parsedValue)}</Text>
              </View>

              {isUrgent && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Taxa de urgência</Text>
                  <Text style={styles.breakdownValueWarning}>
                    +{formatCurrency(urgencyFee)}
                  </Text>
                </View>
              )}

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Taxa de serviço (5%)</Text>
                <Text style={styles.breakdownValueMuted}>
                  +{formatCurrency(serviceFee)}
                </Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownTotalLabel}>Total</Text>
                <Text style={styles.breakdownTotalValue}>
                  {formatCurrency(totalValue)}
                </Text>
              </View>
            </Animated.View>
          )}

          {(locationStatus === 'denied' || locationStatus === 'failed') && (
            <View style={styles.locationBanner}>
              <Text style={styles.locationBannerText}>
                {locationStatus === 'denied'
                  ? 'Permita o acesso à localização para que profissionais próximos vejam seu trampo.'
                  : 'Não conseguimos obter sua localização. Verifique se o GPS está ligado.'}
              </Text>
              <Pressable
                onPress={() => (locationStatus === 'denied' ? Linking.openSettings() : loadLocation())}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.locationBannerAction}>
                  {locationStatus === 'denied' ? 'Abrir configurações' : 'Tentar novamente'}
                </Text>
              </Pressable>
            </View>
          )}

          {!isValid && !createTask.isPending && missingHint && (
            <Text style={styles.missingHint}>{missingHint}</Text>
          )}

          {!!error && (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={styles.errorText}
            >
              {error}
            </Animated.Text>
          )}
        </ScrollView>

        {/* Fixed submit button with glass effect */}
        <View style={styles.bottomContainer}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="light" style={styles.bottomBlur}>
              <View style={styles.bottomContent}>
                <GradientButton
                  label="Solicitar"
                  onPress={handleSubmit}
                  disabled={!isValid}
                  loading={createTask.isPending}
                  iconRight="arrow-forward"
                />
              </View>
            </BlurView>
          ) : (
            <View style={styles.bottomAndroid}>
              <GradientButton
                label="Solicitar"
                onPress={handleSubmit}
                disabled={!isValid}
                loading={createTask.isPending}
                iconRight="arrow-forward"
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  locationBanner: {
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  locationBannerText: {
    color: '#9F1239',
    fontSize: 14,
    lineHeight: 20,
  },
  locationBannerAction: {
    color: '#FF6A00',
    fontWeight: '700',
    marginTop: 8,
    paddingVertical: 4,
  },
  missingHint: {
    color: '#5F6B7E',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 140,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#041E42',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryCard: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E6EBF2',
    shadowColor: '#0B2E5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  categoryCardSelected: {
    borderColor: '#FF6A00',
    backgroundColor: 'rgba(255, 106, 0, 0.05)',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5F6B7E',
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: '#FF6A00',
  },
  categoryCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginBottom: 16,
  },
  urgentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  urgentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  urgentText: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#041E42',
  },
  urgentDescription: {
    fontSize: 13,
    color: '#5F6B7E',
    marginTop: 2,
  },
  breakdownCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginTop: 8,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#041E42',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#5F6B7E',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#041E42',
    fontWeight: '500',
  },
  breakdownValueWarning: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
  },
  breakdownValueMuted: {
    fontSize: 14,
    color: '#5F6B7E',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#EEF3F9',
    marginVertical: 12,
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#041E42',
  },
  breakdownTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6A00',
  },
  errorText: {
    color: '#E11D48',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomBlur: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(230, 235, 242, 0.5)',
  },
  bottomContent: {
    padding: 16,
    paddingBottom: 32,
  },
  bottomAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E6EBF2',
    padding: 16,
    paddingBottom: 32,
  },
});
