import { useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { trpc } from '../../src/lib/trpc';
import { GradientButton } from '../../src/components/GradientButton';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { Input } from '../../src/components/Input';
import { SelectionCard, SelectionCardGroup } from '../../src/components/SelectionCard';

type Role = 'CLIENT' | 'TASKER' | 'BOTH';

const ROLES: { value: Role; title: string; description: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[] = [
  {
    value: 'CLIENT',
    title: 'Preciso de ajuda',
    description: 'Contratar pessoas para fazer serviços',
    icon: 'person-outline',
  },
  {
    value: 'TASKER',
    title: 'Quero trabalhar',
    description: 'Oferecer meus serviços e ganhar dinheiro',
    icon: 'briefcase-outline',
  },
  {
    value: 'BOTH',
    title: 'Os dois',
    description: 'Contratar e também oferecer serviços',
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardingHeader
          title="Complete seu perfil"
          subtitle="Precisamos de algumas informações para começar"
          meshHeight={180}
          meshIntensity="subtle"
        />

        <View style={styles.form}>
          <Animated.View entering={FadeInDown.delay(300).duration(420)}>
            <Input
              label="Nome completo"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(420)}>
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

          <Animated.View
            entering={FadeInDown.delay(500).duration(420)}
            style={styles.roleSection}
          >
            <Animated.Text
              entering={FadeInDown.delay(500).duration(420)}
              style={styles.roleLabel}
            >
              O que você quer fazer?
            </Animated.Text>

            <SelectionCardGroup>
              {ROLES.map((item, index) => (
                <SelectionCard
                  key={item.value}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  selected={role === item.value}
                  onPress={() => setRole(item.value)}
                  index={index}
                />
              ))}
            </SelectionCardGroup>
          </Animated.View>

          {error ? (
            <Animated.Text
              entering={FadeInDown.duration(200)}
              style={styles.errorText}
            >
              {error}
            </Animated.Text>
          ) : null}

          <Animated.View
            entering={FadeInDown.delay(700).duration(420)}
            style={styles.submitContainer}
          >
            <GradientButton
              label="Finalizar cadastro"
              onPress={handleSubmit}
              disabled={!isValid}
              loading={updateProfile.isPending}
              iconRight="arrow-forward"
            />
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  roleSection: {
    marginTop: 8,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#041E42',
    marginBottom: 16,
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
