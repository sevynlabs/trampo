import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { trpc } from '../../../src/lib/trpc';
import { formatCurrency } from '../../../src/lib/format';
import { GradientButton } from '../../../src/components/GradientButton';

export default function PaymentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);

  // Create (or fetch existing) the Pix charge once on mount.
  const createCharge = trpc.payments.createCharge.useMutation({
    onError: (err) => Alert.alert('Erro', err.message),
  });

  useEffect(() => {
    if (id) createCharge.mutate({ taskId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll the payment status until it's confirmed.
  const { data: status } = trpc.payments.getStatus.useQuery(
    { taskId: id! },
    {
      enabled: !!id,
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s === 'PENDING' ? 4000 : false;
      },
    }
  );

  const charge = createCharge.data;
  const isConfirmed = status?.status && status.status !== 'PENDING';

  // When payment is confirmed, refresh the task and dismiss.
  useEffect(() => {
    if (isConfirmed) {
      utils.tasks.getById.invalidate({ id: id! });
      utils.tasks.listMine.invalidate();
    }
  }, [isConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const simulate = trpc.payments.simulatePayment.useMutation({
    onSuccess: () => utils.payments.getStatus.invalidate({ taskId: id! }),
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const handleCopy = async () => {
    if (!charge?.pixCode) return;
    await Clipboard.setStringAsync(charge.pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Pagamento Pix',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="close" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        {/* Confirmed state */}
        {isConfirmed ? (
          <View className="items-center py-12">
            <View className="w-20 h-20 bg-success/10 rounded-full items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={56} color="#0E9F6E" />
            </View>
            <Text className="font-display text-2xl font-bold text-ink mb-2">
              Pagamento confirmado!
            </Text>
            <Text className="text-ink-muted text-center mb-8">
              O valor está protegido e será liberado ao profissional após a conclusão do
              serviço.
            </Text>
            <GradientButton
              label="Voltar ao trampo"
              onPress={() => router.back()}
              iconRight="arrow-forward"
            />
          </View>
        ) : createCharge.isPending || !charge ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#018ABE" />
            <Text className="text-ink-muted mt-3">Gerando cobrança Pix...</Text>
          </View>
        ) : (
          <>
            {/* Amount */}
            <View className="items-center mb-6">
              <Text className="text-ink-muted">Valor a pagar</Text>
              <Text className="font-display text-4xl font-bold text-ink mt-1">
                {formatCurrency(charge.amount)}
              </Text>
            </View>

            {/* QR Code */}
            {charge.pixQrCode ? (
              <View className="bg-surface border border-border rounded-card p-4 items-center mb-6">
                <Image
                  source={{ uri: `data:image/png;base64,${charge.pixQrCode}` }}
                  style={{ width: 220, height: 220 }}
                  resizeMode="contain"
                />
                <Text className="text-ink-muted text-sm mt-3 text-center">
                  Escaneie o QR Code no app do seu banco
                </Text>
              </View>
            ) : null}

            {/* Copy-paste code */}
            <Text className="font-display text-base font-bold text-ink mb-2">
              Ou copie o código Pix
            </Text>
            <View className="bg-surface border border-border rounded-card p-4 mb-3">
              <Text className="text-ink-soft text-xs" numberOfLines={2}>
                {charge.pixCode}
              </Text>
            </View>
            <Pressable
              onPress={handleCopy}
              className={`p-4 rounded-button items-center flex-row justify-center mb-8 ${
                copied ? 'bg-success' : 'bg-accent'
              }`}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={20}
                color="#fff"
              />
              <Text className="text-white font-bold ml-2">
                {copied ? 'Código copiado!' : 'Copiar código Pix'}
              </Text>
            </Pressable>

            {/* Waiting indicator */}
            <View className="flex-row items-center justify-center mb-6">
              <ActivityIndicator color="#5B7A91" />
              <Text className="text-ink-muted ml-2">Aguardando pagamento...</Text>
            </View>

            {/* Dev-only: simulate payment */}
            {__DEV__ && (
              <Pressable
                onPress={() => simulate.mutate({ taskId: id! })}
                disabled={simulate.isPending}
                className="border border-dashed border-warning rounded-button p-3 items-center"
              >
                <Text className="text-warning font-medium text-sm">
                  {simulate.isPending ? 'Simulando...' : '[DEV] Simular pagamento'}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
