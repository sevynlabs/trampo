import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { trpc } from '../../src/lib/trpc';
import { TASK_CONSTANTS } from '@trampo/contracts';

function formatCurrency(centavos: number) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

export default function CreateTaskScreen() {
  const router = useRouter();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState('');

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

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  const parsedValue = parseInt(baseValue.replace(/\D/g, '')) || 0;
  const isValidValue = parsedValue >= TASK_CONSTANTS.MIN_VALUE;

  const urgencyFee = isUrgent ? Math.round(parsedValue * TASK_CONSTANTS.URGENCY_FEE) : 0;
  const serviceFee = Math.round((parsedValue + urgencyFee) * TASK_CONSTANTS.CLIENT_FEE);
  const totalValue = parsedValue + urgencyFee + serviceFee;

  const isValid =
    categoryId &&
    title.length >= 5 &&
    address.length >= 5 &&
    isValidValue &&
    location;

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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Criar serviço',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#18181B" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
        >
          {/* Category */}
          <Text className="text-ink font-medium mb-3">Categoria</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 24 }}
          >
            {categories?.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryId(cat.id)}
                className={`px-4 py-3 rounded-card border ${
                  categoryId === cat.id
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface'
                }`}
              >
                <Text
                  className={`font-medium ${
                    categoryId === cat.id ? 'text-accent' : 'text-ink'
                  }`}
                >
                  {cat.icon} {cat.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Title */}
          <Text className="text-ink font-medium mb-2">O que você precisa?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Limpeza de apartamento 2 quartos"
            className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-6"
            maxLength={200}
          />

          {/* Description */}
          <Text className="text-ink font-medium mb-2">Detalhes (opcional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Descreva o serviço com mais detalhes..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-6 min-h-[100px]"
            maxLength={1000}
          />

          {/* Address */}
          <Text className="text-ink font-medium mb-2">Endereço</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Rua, número, bairro"
            className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-6"
            maxLength={300}
          />

          {/* Value */}
          <Text className="text-ink font-medium mb-2">Valor do serviço</Text>
          <TextInput
            value={baseValue}
            onChangeText={handleValueChange}
            placeholder="R$ 50,00 (mínimo)"
            keyboardType="number-pad"
            className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-2"
          />
          {baseValue && !isValidValue && (
            <Text className="text-danger text-sm mb-4">
              Valor mínimo: {formatCurrency(TASK_CONSTANTS.MIN_VALUE)}
            </Text>
          )}

          {/* Urgent toggle */}
          <View className="flex-row items-center justify-between bg-surface border border-border rounded-card p-4 mb-6">
            <View className="flex-1 mr-4">
              <Text className="text-ink font-medium">Urgente</Text>
              <Text className="text-ink-muted text-sm">
                +30% para serviços em até 1h
              </Text>
            </View>
            <Switch
              value={isUrgent}
              onValueChange={setIsUrgent}
              trackColor={{ false: '#E4E4E7', true: '#2563EB' }}
            />
          </View>

          {/* Price breakdown */}
          {isValidValue && (
            <View className="bg-surface border border-border rounded-card p-4 mb-6">
              <Text className="text-ink font-medium mb-3">Resumo</Text>
              <View className="flex-row justify-between mb-2">
                <Text className="text-ink-muted">Valor base</Text>
                <Text className="text-ink">{formatCurrency(parsedValue)}</Text>
              </View>
              {isUrgent && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-ink-muted">Taxa de urgência</Text>
                  <Text className="text-warning">+{formatCurrency(urgencyFee)}</Text>
                </View>
              )}
              <View className="flex-row justify-between mb-3">
                <Text className="text-ink-muted">Taxa de serviço (5%)</Text>
                <Text className="text-ink-muted">+{formatCurrency(serviceFee)}</Text>
              </View>
              <View className="flex-row justify-between pt-3 border-t border-border">
                <Text className="text-ink font-bold">Total</Text>
                <Text className="text-accent font-bold text-lg">
                  {formatCurrency(totalValue)}
                </Text>
              </View>
            </View>
          )}

          {error && <Text className="text-danger text-sm mb-4">{error}</Text>}
        </ScrollView>

        {/* Fixed submit button */}
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border p-4 pb-8">
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || createTask.isPending}
            className={`w-full py-4 rounded-button items-center ${
              isValid ? 'bg-accent' : 'bg-border'
            }`}
          >
            {createTask.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold ${isValid ? 'text-white' : 'text-ink-faint'}`}>
                Publicar serviço
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
