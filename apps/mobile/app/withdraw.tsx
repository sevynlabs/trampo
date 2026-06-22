import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../src/lib/trpc';
import { formatCurrency } from '../src/lib/format';
import { GradientButton } from '../src/components/GradientButton';

export default function WithdrawScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: balance, isLoading } = trpc.payments.balance.useQuery();
  const [amount, setAmount] = useState(''); // reais string
  const [pixKey, setPixKey] = useState('');

  const available = balance?.available ?? 0;

  // Prefill the saved Pix key and the full available amount once loaded.
  useEffect(() => {
    if (balance) {
      if (balance.pixKey) setPixKey(balance.pixKey);
      setAmount((balance.available / 100).toFixed(2));
    }
  }, [balance]);

  const requestWithdrawal = trpc.payments.requestWithdrawal.useMutation({
    onSuccess: (res) => {
      utils.payments.balance.invalidate();
      utils.payments.listForTasker.invalidate();
      Alert.alert(
        'Saque solicitado',
        res.status === 'PAID'
          ? `${formatCurrency(res.amount)} enviado para sua chave Pix.`
          : `${formatCurrency(res.amount)} em processamento. Você recebe em instantes.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const amountCents = Math.round(parseFloat(amount.replace(',', '.') || '0') * 100);
  const valid =
    amountCents >= 1000 && amountCents <= available && pixKey.trim().length >= 3;

  const handleSubmit = () => {
    if (!valid) return;
    requestWithdrawal.mutate({ amount: amountCents, pixKey: pixKey.trim() });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Sacar',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#018ABE" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Available */}
            <View className="bg-surface border border-border rounded-card p-5 mb-6 items-center">
              <Text className="text-ink-muted text-sm">Disponível para saque</Text>
              <Text className="font-display text-3xl font-bold text-ink mt-1">
                {formatCurrency(available)}
              </Text>
            </View>

            {/* Amount */}
            <Text className="text-ink font-medium mb-2">Valor</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-button px-4 mb-2">
              <Text className="text-ink-muted font-bold">R$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#94B2C4"
                className="flex-1 py-4 ml-2 text-ink text-lg"
              />
              <Pressable onPress={() => setAmount((available / 100).toFixed(2))} hitSlop={8}>
                <Text className="text-accent font-bold text-sm">TUDO</Text>
              </Pressable>
            </View>
            <Text className="text-ink-faint text-xs mb-6">Mínimo R$ 10,00</Text>

            {/* Pix key */}
            <Text className="text-ink font-medium mb-2">Chave Pix</Text>
            <TextInput
              value={pixKey}
              onChangeText={setPixKey}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              placeholderTextColor="#94B2C4"
              className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-8"
            />

            <GradientButton
              label="Solicitar saque"
              icon="cash-outline"
              onPress={handleSubmit}
              disabled={!valid}
              loading={requestWithdrawal.isPending}
            />
            {available < 1000 && (
              <Text className="text-ink-muted text-center text-sm mt-4">
                Você precisa de pelo menos R$ 10,00 disponíveis para sacar.
              </Text>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
