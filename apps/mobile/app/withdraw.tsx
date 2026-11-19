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
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, BounceIn } from 'react-native-reanimated';
import { trpc } from '../src/lib/trpc';
import { formatCurrency, centsToInput, parseMoneyToCents } from '../src/lib/format';
import { GradientButton } from '../src/components/GradientButton';

type ScreenState = 'form' | 'processing' | 'success' | 'error';

export default function WithdrawScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: balance, isLoading, isError: balanceError, refetch: refetchBalance } =
    trpc.payments.balance.useQuery();
  const [amount, setAmount] = useState(''); // reais string
  const [pixKey, setPixKey] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<{
    amount: number;
    id: string;
    pending: boolean;
  } | null>(null);
  // Unknown outcome (network failure): the transfer may have gone through
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);

  const available = balance?.available ?? 0;

  // Prefill the saved Pix key and the full available amount once loaded.
  useEffect(() => {
    if (balance) {
      if (balance.pixKey) setPixKey(balance.pixKey);
      setAmount(centsToInput(balance.available));
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
      setSuccessData({ amount: res.amount, id: res.id, pending: res.status === 'PENDING' });
      setScreenState('success');
    },
    onError: (err) => {
      // No tRPC error code = the request never got a definitive answer
      setOutcomeUnknown(!err.data?.code);
      utils.payments.balance.invalidate();
      setErrorMessage(err.message);
      setScreenState('error');
    },
  });

  const amountCents = parseMoneyToCents(amount);
  const amountValid = Number.isFinite(amountCents);
  const validationMessage = !amountValid
    ? 'Informe um valor válido'
    : amountCents < 1000
      ? 'O valor mínimo é R$ 10,00'
      : amountCents > available
        ? 'O valor é maior que o seu saldo disponível'
        : pixKey.trim().length < 3
          ? 'Informe a chave Pix'
          : null;
  const valid = validationMessage === null;

  const handleSubmit = () => {
    if (!valid) return;
    const key = pixKey.trim();
    Alert.alert(
      'Confirmar saque',
      `Enviar ${formatCurrency(amountCents)} para a chave Pix ${maskPixKey(key)}?\n\nConfira a chave: transferências Pix não podem ser desfeitas.`,
      [
        { text: 'Revisar', style: 'cancel' },
        {
          text: 'Confirmar saque',
          onPress: () => requestWithdrawal.mutate({ amount: amountCents, pixKey: key }),
        },
      ]
    );
  };

  const handleRetry = () => {
    setScreenState('form');
    setErrorMessage('');
  };

  const handleCancel = () => {
    router.back();
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
      <ActivityIndicator size="large" color="#FF6A00" />
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
          {successData.pending ? 'Saque em processamento' : 'Pix enviado!'}
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(500)} style={styles.successAmount}>
          {formatCurrency(successData.amount)}
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(600)} style={styles.successDetail}>
          para {maskedKey}
        </Animated.Text>

        {successData.pending && (
          <Animated.Text entering={FadeInDown.delay(650)} style={styles.successDetail}>
            O banco ainda não confirmou a transferência. Ela aparece no seu extrato
            assim que for concluída.
          </Animated.Text>
        )}

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
          {outcomeUnknown
            ? 'Não recebemos confirmação. Confira seu saldo antes de tentar de novo.'
            : 'Seu saldo foi mantido.'}
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
          <ActivityIndicator size="large" color="#FF6A00" />
        </View>
      ) : balanceError ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorMessage}>Não foi possível carregar seu saldo.</Text>
          <Pressable onPress={() => refetchBalance()} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.maxButton}>Tentar novamente</Text>
          </Pressable>
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
              placeholderTextColor="#9AA5B8"
              style={styles.amountInput}
            />
            <Pressable
              onPress={() => setAmount(centsToInput(available))}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Sacar todo o saldo"
            >
              <Text style={styles.maxButton}>Tudo</Text>
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
            placeholder="CPF, e-mail, +55 telefone ou chave aleatória"
            placeholderTextColor="#9AA5B8"
            style={styles.pixKeyInput}
          />

          <GradientButton
            label="Solicitar saque"
            icon="cash-outline"
            onPress={handleSubmit}
            disabled={!valid}
            loading={requestWithdrawal.isPending}
          />
          {available < 1000 ? (
            <Text style={styles.insufficientFundsText}>
              Você precisa de pelo menos R$ 10,00 disponíveis para sacar.
            </Text>
          ) : (
            validationMessage && (
              <Text style={styles.insufficientFundsText}>{validationMessage}</Text>
            )
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
          // Don't let the user leave mid-transfer
          gestureEnabled: screenState !== 'processing',
          headerLeft: () =>
            screenState === 'processing' ? null : (
              <Pressable
                onPress={() => router.back()}
                style={styles.headerBackButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <Ionicons name="arrow-back" size={24} color="#041E42" />
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
    backgroundColor: '#F5F8FC',
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
    borderColor: '#E6EBF2',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  availableLabel: {
    color: '#5F6B7E',
    fontSize: 14,
  },
  availableAmount: {
    fontFamily: 'System',
    fontSize: 30,
    fontWeight: 'bold',
    color: '#041E42',
    marginTop: 4,
  },

  // Input labels
  inputLabel: {
    color: '#041E42',
    fontWeight: '500',
    marginBottom: 8,
  },

  // Amount input
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EBF2',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  currencyPrefix: {
    color: '#5F6B7E',
    fontWeight: 'bold',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 8,
    color: '#041E42',
    fontSize: 18,
  },
  maxButton: {
    color: '#FF6A00',
    fontWeight: 'bold',
    fontSize: 14,
  },
  minAmountHint: {
    color: '#9AA5B8',
    fontSize: 12,
    marginBottom: 24,
  },

  // Pix key input
  pixKeyInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EBF2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#041E42',
    marginBottom: 32,
  },

  // Insufficient funds
  insufficientFundsText: {
    color: '#5F6B7E',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 16,
  },

  // Processing screen
  processingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#041E42',
    marginTop: 24,
  },
  processingAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6A00',
    marginTop: 8,
  },

  // Success screen
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#041E42',
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
    color: '#5F6B7E',
    marginTop: 12,
    textAlign: 'center',
  },
  successId: {
    fontSize: 14,
    color: '#5F6B7E',
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
    color: '#041E42',
    marginTop: 24,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#5F6B7E',
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
    color: '#5F6B7E',
    fontSize: 16,
    fontWeight: '600',
  },
});
