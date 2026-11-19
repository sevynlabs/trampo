import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { trpc } from '../../src/lib/trpc';
import { Logo, Button, colors, shadow } from '../../src/components/ds';

/** "Entrar na sua conta" — phone + SMS code (OTP). The same flow creates new accounts. */
export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ddd, setDdd] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const numberRef = useRef<TextInput>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
      router.push({ pathname: '/(auth)/otp', params: { phone: `+55${ddd}${number}` } });
    },
    onError: (err) => setError(err.message),
  });

  const isValid = ddd.length === 2 && number.length === 9;
  const handleSubmit = () => {
    if (!isValid) return;
    setError('');
    requestOtp.mutate({ phone: `+55${ddd}${number}` });
  };

  const socialSoon = (provider: string) =>
    Alert.alert(`Entrar com ${provider}`, 'Em breve! Por enquanto, entre com o seu celular.');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        {router.canGoBack() && (
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar" style={{ alignSelf: 'flex-start', padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
        )}

        <Animated.View entering={FadeInDown.duration(420)} style={{ alignItems: 'center', marginTop: 24, marginBottom: 40 }}>
          <Logo size={52} />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(100).duration(420)} style={{ fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 6 }}>
          Entrar na sua conta
        </Animated.Text>
        <Text style={{ fontSize: 14.5, color: colors.inkMuted, marginBottom: 20 }}>
          Vamos enviar um código por SMS para confirmar o seu número.
        </Text>

        <Animated.View
          entering={FadeInDown.delay(200).duration(420)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 56,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.input,
            paddingHorizontal: 14,
            backgroundColor: '#fff',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 18 }}>🇧🇷</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink, marginLeft: 8 }}>+55</Text>
          <TextInput
            value={ddd}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 2);
              setDdd(digits);
              if (digits.length >= 2) numberRef.current?.focus();
            }}
            placeholder="(34)"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel="DDD"
            style={{ width: 48, fontSize: 16, color: colors.ink, textAlign: 'center', marginLeft: 8, paddingVertical: 0 }}
          />
          <TextInput
            ref={numberRef}
            value={number}
            onChangeText={(text) => setNumber(text.replace(/\D/g, '').slice(0, 9))}
            placeholder="9 9999-9999"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            maxLength={9}
            accessibilityLabel="Número do celular"
            style={{ flex: 1, fontSize: 16, color: colors.ink, marginLeft: 4, paddingVertical: 0 }}
            onSubmitEditing={handleSubmit}
          />
        </Animated.View>

        {error ? <Text style={{ color: colors.danger, fontSize: 13.5, marginBottom: 8 }}>{error}</Text> : null}

        <Button label="Continuar" onPress={handleSubmit} disabled={!isValid} loading={requestOtp.isPending} style={{ marginTop: 12 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 22 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
          <Text style={{ marginHorizontal: 12, color: colors.inkMuted, fontSize: 13 }}>ou</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
        </View>

        <SocialButton icon="logo-google" iconColor="#EA4335" label="Continuar com Google" onPress={() => socialSoon('Google')} />
        <SocialButton icon="logo-apple" iconColor="#000" label="Continuar com Apple" onPress={() => socialSoon('Apple')} />

        <View style={{ flex: 1 }} />
        <Text style={{ textAlign: 'center', fontSize: 13.5, color: colors.inkMuted, marginTop: 24 }}>
          Ainda não tem conta?{' '}
          <Text style={{ color: colors.orange, fontWeight: '700' }} onPress={() => numberRef.current?.focus()}>
            Criar agora
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SocialButton({ icon, iconColor, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; iconColor: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: 16,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          ...shadow.card,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={{ marginLeft: 10, fontSize: 15, fontWeight: '600', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
