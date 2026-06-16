import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../src/lib/trpc';

export default function PhoneScreen() {
  const router = useRouter();
  const [ddd, setDdd] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const numberRef = useRef<TextInput>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: (data) => {
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: `+55${ddd}${number}` },
      });
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const phone = `+55${ddd}${number}`;
  const isValid = ddd.length === 2 && number.length >= 8;

  const handleSubmit = () => {
    if (!isValid) return;
    setError('');
    requestOtp.mutate({ phone });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 px-6 pt-20">
        {/* Header */}
        <Text className="font-display text-3xl font-bold text-ink mb-2">
          Qual seu número?
        </Text>
        <Text className="text-ink-muted mb-8">
          Vamos enviar um código SMS para confirmar
        </Text>

        {/* Phone input */}
        <View className="flex-row items-center gap-3 mb-4">
          <View className="bg-surface border border-border rounded-button px-4 py-4">
            <Text className="text-ink-muted">+55</Text>
          </View>

          <TextInput
            value={ddd}
            onChangeText={(text) => {
              setDdd(text.replace(/\D/g, '').slice(0, 2));
              if (text.length >= 2) numberRef.current?.focus();
            }}
            placeholder="DDD"
            keyboardType="number-pad"
            maxLength={2}
            className="bg-surface border border-border rounded-button px-4 py-4 w-20 text-ink text-center"
          />

          <TextInput
            ref={numberRef}
            value={number}
            onChangeText={(text) => setNumber(text.replace(/\D/g, '').slice(0, 9))}
            placeholder="00000-0000"
            keyboardType="number-pad"
            maxLength={9}
            className="flex-1 bg-surface border border-border rounded-button px-4 py-4 text-ink"
          />
        </View>

        {error ? (
          <Text className="text-danger text-sm mb-4">{error}</Text>
        ) : null}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || requestOtp.isPending}
          className={`w-full py-4 rounded-button items-center ${
            isValid ? 'bg-accent' : 'bg-border'
          }`}
        >
          {requestOtp.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={`font-bold ${isValid ? 'text-white' : 'text-ink-faint'}`}>
              Continuar
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
