import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { trpc, setTokens } from '../../src/lib/trpc';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: async (data) => {
      // Store both access and refresh tokens
      await setTokens(data.accessToken, data.refreshToken);

      // Navigate based on user state
      if (data.isNewUser || !data.user.name) {
        router.replace('/(auth)/profile-setup');
      } else {
        router.replace('/(tabs)/home');
      }
    },
    onError: () => {
      setError('Código inválido. Tente novamente.');
      setCode('');
    },
  });

  const resendOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
      setCountdown(60);
      setError('');
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (code.length === OTP_LENGTH) {
      verifyOtp.mutate({ phone: phone!, code });
    }
  }, [code]);

  const formatPhone = (p: string) => {
    const digits = p.replace(/\D/g, '');
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 px-6 pt-20">
        {/* Header */}
        <Text className="font-display text-3xl font-bold text-ink mb-2">
          Digite o código
        </Text>
        <Text className="text-ink-muted mb-8">
          Enviamos um SMS para {formatPhone(phone || '')}
        </Text>

        {/* OTP Input */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          className="flex-row justify-center gap-3 mb-6"
        >
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <View
              key={i}
              className={`w-12 h-14 rounded-button items-center justify-center border-2 ${
                code.length === i
                  ? 'border-accent bg-surface'
                  : code[i]
                  ? 'border-border-strong bg-surface'
                  : 'border-border bg-surface'
              }`}
            >
              <Text className="font-display text-2xl text-ink">
                {code[i] || ''}
              </Text>
            </View>
          ))}
        </Pressable>

        {/* Hidden input */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoComplete="one-time-code"
          className="absolute opacity-0"
        />

        {error ? (
          <Text className="text-danger text-sm text-center mb-4">{error}</Text>
        ) : null}

        {verifyOtp.isPending && (
          <View className="items-center mb-4">
            <ActivityIndicator color="#2563EB" />
          </View>
        )}

        {/* Resend */}
        <View className="items-center">
          {countdown > 0 ? (
            <Text className="text-ink-muted">
              Reenviar código em {countdown}s
            </Text>
          ) : (
            <Pressable
              onPress={() => resendOtp.mutate({ phone: phone! })}
              disabled={resendOtp.isPending}
            >
              <Text className="text-accent font-bold">Reenviar código</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
