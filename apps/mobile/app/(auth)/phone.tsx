import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { trpc } from '../../src/lib/trpc';
import { GradientButton } from '../../src/components/GradientButton';
import { GradientMesh } from '../../src/components/GradientMesh';

export default function PhoneScreen() {
  const router = useRouter();
  const [ddd, setDdd] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const numberRef = useRef<TextInput>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
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
  const isValid = ddd.length === 2 && number.length === 9;

  const handleSubmit = () => {
    if (!isValid) return;
    setError('');
    requestOtp.mutate({ phone });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Gradient Mesh Background */}
      <View style={styles.meshContainer} pointerEvents="none">
        <GradientMesh height={220} intensity="normal" animated={false} />
      </View>

      <View style={styles.content}>
        {router.canGoBack() && (
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color="#001B48" />
          </Pressable>
        )}
        <Animated.Text
          entering={FadeInDown.delay(100).duration(420)}
          style={styles.title}
        >
          Qual é o seu celular?
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(200).duration(420)}
          style={styles.subtitle}
        >
          Vamos enviar um código SMS para confirmar
        </Animated.Text>

        {/* Phone input - original working design */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(420)}
          style={styles.phoneRow}
        >
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>+55</Text>
          </View>

          <TextInput
            value={ddd}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 2);
              setDdd(digits);
              if (digits.length >= 2) numberRef.current?.focus();
            }}
            placeholder="DDD"
            placeholderTextColor="#94B2C4"
            keyboardType="number-pad"
            maxLength={2}
            style={styles.dddInput}
          />

          <TextInput
            ref={numberRef}
            value={number}
            onChangeText={(text) => setNumber(text.replace(/\D/g, '').slice(0, 9))}
            placeholder="00000-0000"
            placeholderTextColor="#94B2C4"
            keyboardType="number-pad"
            maxLength={9}
            style={styles.numberInput}
          />
        </Animated.View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <Animated.View entering={FadeInDown.delay(400).duration(420)}>
          <GradientButton
            label="Continuar"
            onPress={handleSubmit}
            disabled={!isValid}
            loading={requestOtp.isPending}
            iconRight="arrow-forward"
          />
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
    marginBottom: 32,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  prefix: {
    backgroundColor: '#EEF6FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#DCEAF1',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5B7A91',
  },
  dddInput: {
    width: 72,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#DCEAF1',
    fontSize: 16,
    color: '#001B48',
    textAlign: 'center',
  },
  numberInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#DCEAF1',
    fontSize: 16,
    color: '#001B48',
  },
  error: {
    color: '#E11D48',
    fontSize: 14,
    marginBottom: 16,
  },
});
