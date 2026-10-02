import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { trpc, setTokens } from '../../src/lib/trpc';
import { GradientMesh } from '../../src/components/GradientMesh';
import { OtpInput } from '../../src/components/OtpInput';

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [success, setSuccess] = useState(false);

  const utils = trpc.useUtils();

  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: async (data) => {
      setSuccess(true);
      await setTokens(data.accessToken, data.refreshToken);
      await utils.invalidate();

      // Small delay to show success state
      setTimeout(() => {
        if (data.isNewUser || !data.user.name) {
          router.replace('/(auth)/profile-setup');
        } else {
          router.replace('/(tabs)/home');
        }
      }, 500);
    },
    onError: (err) => {
      // Only a rejected code is "invalid"; network/limit errors say so
      const code = err.data?.code;
      setError(
        code === 'BAD_REQUEST'
          ? 'Código inválido. Tente novamente.'
          : code === 'TOO_MANY_REQUESTS' || code === 'FORBIDDEN'
            ? err.message
            : 'Não foi possível verificar agora. Confira sua conexão e tente de novo.'
      );
      setCode('');
    },
  });

  const resendOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
      setCountdown(60);
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (code.length === 6 && !verifyOtp.isPending && !success) {
      verifyOtp.mutate({ phone: phone!, code });
    }
  }, [code]);

  const formatPhone = (p: string) => {
    const digits = p.replace(/\D/g, '');
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Gradient Mesh Background */}
      <View style={styles.meshContainer}>
        <GradientMesh height={220} intensity="normal" />
      </View>

      <View style={styles.content}>
        {/* Back button */}
        <Animated.View entering={FadeInDown.delay(50).duration(420)}>
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color="#001B48" />
          </Pressable>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(100).duration(420)}
          style={styles.title}
        >
          Digite o código
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(200).duration(420)}
          style={styles.subtitle}
        >
          Enviamos um SMS para{' '}
          <Text style={styles.phoneHighlight}>{formatPhone(phone || '')}</Text>
        </Animated.Text>

        {/* OTP Input */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(420)}
          style={styles.otpContainer}
        >
          <OtpInput
            value={code}
            onChange={setCode}
            error={error}
            success={success}
            disabled={verifyOtp.isPending || success}
          />
        </Animated.View>

        {/* Loading indicator */}
        {verifyOtp.isPending && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#018ABE" size="small" />
            <Text style={styles.loadingText}>Verificando...</Text>
          </View>
        )}

        {/* Resend section */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(420)}
          style={styles.resendContainer}
        >
          {countdown > 0 ? (
            <Text style={styles.countdownText}>
              Reenviar código em{' '}
              <Text style={styles.countdownNumber}>{countdown}s</Text>
            </Text>
          ) : (
            <Pressable
              onPress={() => resendOtp.mutate({ phone: phone! })}
              disabled={resendOtp.isPending}
              style={styles.resendButton}
            >
              {resendOtp.isPending ? (
                <ActivityIndicator color="#018ABE" size="small" />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color="#018ABE" />
                  <Text style={styles.resendText}>Reenviar código</Text>
                </>
              )}
            </Pressable>
          )}
        </Animated.View>

        {/* Change number link */}
        <Animated.View entering={FadeInDown.delay(500).duration(420)}>
          <Pressable onPress={handleBack} style={styles.changeNumberButton}>
            <Text style={styles.changeNumberText}>Alterar número</Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FB',
  },
  meshContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#02457A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#001B48',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5B7A91',
    marginBottom: 40,
    lineHeight: 22,
  },
  phoneHighlight: {
    color: '#02457A',
    fontWeight: '600',
  },
  otpContainer: {
    marginBottom: 32,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#5B7A91',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  countdownText: {
    fontSize: 14,
    color: '#5B7A91',
  },
  countdownNumber: {
    fontWeight: '600',
    color: '#02457A',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(1, 138, 190, 0.08)',
    borderRadius: 12,
  },
  resendText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#018ABE',
  },
  changeNumberButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  changeNumberText: {
    fontSize: 14,
    color: '#5B7A91',
    textDecorationLine: 'underline',
  },
});
