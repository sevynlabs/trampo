import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, BounceIn } from 'react-native-reanimated';
import { trpc } from '../src/lib/trpc';
import { formatCurrency } from '../src/lib/format';
import { GradientButton } from '../src/components/GradientButton';

type ScreenState = 'form' | 'processing' | 'success' | 'error';

export default function WithdrawScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: balance, isLoading } = trpc.payments.balance.useQuery();
  const [amount, setAmount] = useState(''); // reais string
  const [pixKey, setPixKey] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<{ amount: number; id: string } | null>(null);

  const available = balance?.available ?? 0;

  // Prefill the saved Pix key and the full available amount once loaded.
  useEffect(() => {
    if (balance) {
      if (balance.pixKey) setPixKey(balance.pixKey);
      setAmount((balance.available / 100).toFixed(2));
    }
  }, [balance]);

  const requestWithdrawal = trpc.payments.requestWithdrawal.useMutation({
    onMutate: () => {
      setScreenState('processing');
      setErrorMessage('');
    },
    onSuccess: (res) => {
      utils.payments.balance.invalidate();
      utils.payments.listForTasker.invalidate();
      setSuccessData({ amount: res.amount, id: res.id });
      setScreenState('success');
    },
    onError: (err) => {
      setErrorMessage(err.message);
      setScreenState('error');
    },
  });

  const amountCents = Math.round(parseFloat(amount.replace(',', '.') || '0') * 100);
  const valid =
    amountCents >= 1000 && amountCents <= available && pixKey.trim().length >= 3;

  const handleSubmit = () => {
    if (!valid) return;
    requestWithdrawal.mutate({ amount: amountCents, pixKey: pixKey.trim() });
  };

  const handleRetry = () => {
    setScreenState('form');
    setErrorMessage('');
  };

  const handleCancel = () => {
    setScreenState('form');
    setErrorMessage('');
  };

  const handleBackToHome = () => {
    router.back();
  };

  const maskPixKey = (key: string): string => {
    if (key.includes('@')) {
      const [local, domain] = key.split('@');
      if (local.length <= 2) return key;
      return `${local.slice(0, 2)}****@${domain}`;
    }
    if (key.length <= 4) return key;
    const last4 = key.slice(-4);
    return `****${last4}`;
  };

  const renderProcessingScreen = () => (
    <Animated.View entering={FadeIn} style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#018ABE" />
      <Text style={styles.processingTitle}>Enviando Pix...</Text>
      <Text style={styles.processingAmount}>{formatCurrency(amountCents)}</Text>
    </Animated.View>
  );

  const renderSuccessScreen = () => {
    if (!successData) return null;

    const maskedKey = maskPixKey(pixKey.trim());
    const shortId = successData.id.slice(-8).toUpperCase();

    return (
      <Animated.View entering={FadeIn} style={styles.centerContainer}>
        <Animated.View entering={BounceIn.delay(200)}>
          <Ionicons name="checkmark-circle" size={80} color="#0E9F6E" />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(400)} style={styles.successTitle}>
          Pix Enviado!
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(500)} style={styles.successAmount}>
          {formatCurrency(successData.amount)}
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(600)} style={styles.successDetail}>
          para {maskedKey}
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(700)} style={styles.successId}>
          ID: {shortId}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(800)} style={styles.successButtonContainer}>
          <GradientButton
            label="Voltar"
            iconRight="arrow-forward"
            onPress={handleBackToHome}
          />
        </Animated.View>
      </Animated.View>
    );
  };

  const renderErrorScreen = () => {
    const isPixKeyError = errorMessage.toLowerCase().includes('pix') ||
                          errorMessage.toLowerCase().includes('chave');

    return (
      <Animated.View entering={FadeIn} style={styles.centerContainer}>
        <Animated.View entering={BounceIn.delay(200)}>
          <Ionicons name="close-circle" size={80} color="#E11D48" />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(400)} style={styles.errorTitle}>
          Saque não concluído
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(500)} style={styles.errorMessage}>
          {errorMessage}
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(600)} style={styles.balanceMaintained}>
          Seu saldo foi mantido.
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(700)} style={styles.errorButtonContainer}>
          <GradientButton
            label={isPixKeyError ? 'Corrigir chave Pix' : 'Tentar novamente'}
            icon="refresh"
            onPress={handleRetry}
          />

          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  };

  const renderFormScreen = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex1}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#018ABE" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Available */}
          <View style={styles.availableCard}>
            <Text style={styles.availableLabel}>Disponível para saque</Text>
            <Text style={styles.availableAmount}>{formatCurrency(available)}</Text>
          </View>

          {/* Amount */}
          <Text style={styles.inputLabel}>Valor</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor="#94B2C4"
              style={styles.amountInput}
            />
            <Pressable onPress={() => setAmount((available / 100).toFixed(2))} hitSlop={8}>
              <Text style={styles.maxButton}>TUDO</Text>
            </Pressable>
          </View>
          <Text style={styles.minAmountHint}>Mínimo R$ 10,00</Text>

          {/* Pix key */}
          <Text style={styles.inputLabel}>Chave Pix</Text>
          <TextInput
            value={pixKey}
            onChangeText={setPixKey}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="CPF, e-mail, telefone ou chave aleatória"
            placeholderTextColor="#94B2C4"
            style={styles.pixKeyInput}
          />

          <GradientButton
            label="Solicitar saque"
            icon="cash-outline"
            onPress={handleSubmit}
            disabled={!valid}
            loading={requestWithdrawal.isPending}
          />
          {available < 1000 && (
            <Text style={styles.insufficientFundsText}>
              Você precisa de pelo menos R$ 10,00 disponíveis para sacar.
            </Text>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Sacar',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.headerBackButton}>
              <Ionicons name="arrow-back" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      <View style={styles.container}>
        {screenState === 'form' && renderFormScreen()}
        {screenState === 'processing' && renderProcessingScreen()}
        {screenState === 'success' && renderSuccessScreen()}
        {screenState === 'error' && renderErrorScreen()}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FB',
  },
  flex1: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  headerBackButton: {
    marginRight: 16,
  },

  // Available card
  availableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEAF1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  availableLabel: {
    color: '#5B7A91',
    fontSize: 14,
  },
  availableAmount: {
    fontFamily: 'System',
    fontSize: 30,
    fontWeight: 'bold',
    color: '#001B48',
    marginTop: 4,
  },

  // Input labels
  inputLabel: {
    color: '#001B48',
    fontWeight: '500',
    marginBottom: 8,
  },

  // Amount input
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEAF1',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  currencyPrefix: {
    color: '#5B7A91',
    fontWeight: 'bold',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 8,
    color: '#001B48',
    fontSize: 18,
  },
  maxButton: {
    color: '#018ABE',
    fontWeight: 'bold',
    fontSize: 14,
  },
  minAmountHint: {
    color: '#94B2C4',
    fontSize: 12,
    marginBottom: 24,
  },

  // Pix key input
  pixKeyInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEAF1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#001B48',
    marginBottom: 32,
  },

  // Insufficient funds
  insufficientFundsText: {
    color: '#5B7A91',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 16,
  },

  // Processing screen
  processingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#001B48',
    marginTop: 24,
  },
  processingAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#018ABE',
    marginTop: 8,
  },

  // Success screen
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#001B48',
    marginTop: 24,
    textAlign: 'center',
  },
  successAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#0E9F6E',
    marginTop: 16,
    textAlign: 'center',
  },
  successDetail: {
    fontSize: 16,
    color: '#5B7A91',
    marginTop: 12,
    textAlign: 'center',
  },
  successId: {
    fontSize: 14,
    color: '#5B7A91',
    marginTop: 8,
    fontFamily: 'Courier',
    textAlign: 'center',
  },
  successButtonContainer: {
    width: '100%',
    marginTop: 32,
  },

  // Error screen
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#001B48',
    marginTop: 24,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#5B7A91',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  balanceMaintained: {
    fontSize: 14,
    color: '#0E9F6E',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorButtonContainer: {
    width: '100%',
    marginTop: 32,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#5B7A91',
    fontSize: 16,
    fontWeight: '600',
  },
});
