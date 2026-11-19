import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { trpc } from '../../src/lib/trpc';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { Button, IconCircle, colors } from '../../src/components/ds';

type Role = 'CLIENT' | 'TASKER' | 'BOTH';

const ROLES: { value: Role; title: string; description: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[] = [
  {
    value: 'CLIENT',
    title: 'Quero contratar serviços',
    description: 'Encontre profissionais para o que você precisa.',
    icon: 'people-outline',
  },
  {
    value: 'TASKER',
    title: 'Quero prestar serviços',
    description: 'Divulgue seu trabalho e conquiste clientes.',
    icon: 'construct-outline',
  },
  {
    value: 'BOTH',
    title: 'Quero os dois',
    description: 'Contratar e também oferecer serviços.',
    icon: 'swap-horizontal-outline',
  },
];

/** CPF check digits (mod 11). Rejects repeated-digit numbers like 111.111.111-11. */
function isValidCpfNumber(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || new Set(digits).size === 1) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState('');

  const utils = trpc.useUtils();

  const updateProfile = trpc.profiles.updateProfile.useMutation({
    onSuccess: () => {
      utils.profiles.getMe.invalidate();
      if (role === 'TASKER' || role === 'BOTH') {
        // A new tasker has no categories yet (empty feed): set them up first
        router.replace('/(tabs)/home');
        router.push('/profile/categories');
      } else {
        router.replace('/(tabs)/home');
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const cpfDigits = cpf.replace(/\D/g, '');
  const isValidCpf = isValidCpfNumber(cpfDigits);
  const isValid = name.length >= 2 && isValidCpf && role;

  const handleSubmit = () => {
    if (!isValid || !role) return;
    setError('');
    updateProfile.mutate({
      name,
      cpf: cpfDigits,
      role,
    });
  };

  const [step, setStep] = useState<'role' | 'data'>('role');

  if (step === 'role') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
        <View style={{ paddingHorizontal: 24, flex: 1 }}>
          <Text style={styles.bigTitle}>Como você quer{`\n`}usar o Trampo?</Text>
          <Text style={styles.subtitle}>Você pode mudar isso depois no seu perfil.</Text>
          {ROLES.map((item, index) => (
            <Animated.View key={item.value} entering={FadeInDown.delay(100 + index * 80).duration(380)}>
              <RoleCard item={item} selected={role === item.value} onPress={() => setRole(item.value)} />
            </Animated.View>
          ))}
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <Button label="Continuar" disabled={!role} onPress={() => setStep('data')} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Pressable onPress={() => setStep('role')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar" style={{ alignSelf: 'flex-start', padding: 4, marginBottom: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.bigTitle}>Complete seu perfil</Text>
          <Text style={styles.subtitle}>Precisamos de algumas informações para começar.</Text>

          <Animated.View entering={FadeInDown.delay(100).duration(420)}>
            <Input label="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(420)}>
            <Input
              label="CPF"
              value={cpf}
              onChangeText={(text) => setCpf(formatCpf(text))}
              keyboardType="number-pad"
              maxLength={14}
              success={isValidCpf}
              error={
                cpfDigits.length > 0 && cpfDigits.length < 11
                  ? 'CPF incompleto'
                  : cpfDigits.length === 11 && !isValidCpf
                    ? 'CPF inválido'
                    : undefined
              }
            />
          </Animated.View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.inkMuted} />
            <Text style={{ marginLeft: 6, fontSize: 12.5, color: colors.inkMuted }}>Seu CPF é criptografado e nunca fica visível.</Text>
          </View>

          {error ? <Animated.Text entering={FadeInDown.duration(200)} style={styles.errorText}>{error}</Animated.Text> : null}

          <View style={styles.submitContainer}>
            <Button label="Finalizar cadastro" onPress={handleSubmit} disabled={!isValid} loading={updateProfile.isPending} iconRight="arrow-forward" />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({ item, selected, onPress }: { item: (typeof ROLES)[number]; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.roleCard, selected && { borderColor: colors.orange, backgroundColor: colors.orangeTint }]}
    >
      <IconCircle icon={item.icon} size={54} bg={selected ? '#fff' : colors.orangeTint} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: colors.inkMuted, marginTop: 3 }}>{item.description}</Text>
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.orange : colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  bigTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#041E42',
    letterSpacing: -0.6,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14.5,
    color: '#5F6B7E',
    marginTop: 6,
    marginBottom: 24,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E6EBF2',
    backgroundColor: '#fff',
    marginBottom: 14,
  },
  errorText: {
    color: '#E11D48',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  submitContainer: {
    marginTop: 32,
  },
});
