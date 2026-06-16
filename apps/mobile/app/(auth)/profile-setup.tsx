import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../src/lib/trpc';

type Role = 'CLIENT' | 'TASKER' | 'BOTH';

const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: 'CLIENT',
    label: 'Preciso de ajuda',
    description: 'Contratar pessoas para fazer serviços',
  },
  {
    value: 'TASKER',
    label: 'Quero trabalhar',
    description: 'Oferecer meus serviços e ganhar dinheiro',
  },
  {
    value: 'BOTH',
    label: 'Os dois',
    description: 'Contratar e também oferecer serviços',
  },
];

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
        // TODO: go to category selection
        router.replace('/(tabs)/feed');
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

  const isValid = name.length >= 2 && cpf.replace(/\D/g, '').length === 11 && role;

  const handleSubmit = () => {
    if (!isValid || !role) return;
    setError('');
    updateProfile.mutate({
      name,
      cpf: cpf.replace(/\D/g, ''),
      role,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-1 px-6 pt-20">
          {/* Header */}
          <Text className="font-display text-3xl font-bold text-ink mb-2">
            Complete seu perfil
          </Text>
          <Text className="text-ink-muted mb-8">
            Precisamos de algumas informações para começar
          </Text>

          {/* Name */}
          <Text className="text-ink font-medium mb-2">Nome completo</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Como você quer ser chamado"
            autoCapitalize="words"
            className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-6"
          />

          {/* CPF */}
          <Text className="text-ink font-medium mb-2">CPF</Text>
          <TextInput
            value={cpf}
            onChangeText={(text) => setCpf(formatCpf(text))}
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            maxLength={14}
            className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-6"
          />

          {/* Role selection */}
          <Text className="text-ink font-medium mb-3">O que você quer fazer?</Text>
          <View className="gap-3 mb-6">
            {ROLES.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setRole(item.value)}
                className={`p-4 rounded-card border-2 ${
                  role === item.value
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface'
                }`}
              >
                <Text
                  className={`font-bold text-base ${
                    role === item.value ? 'text-accent' : 'text-ink'
                  }`}
                >
                  {item.label}
                </Text>
                <Text className="text-ink-muted text-sm mt-1">
                  {item.description}
                </Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <Text className="text-danger text-sm mb-4">{error}</Text>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || updateProfile.isPending}
            className={`w-full py-4 rounded-button items-center ${
              isValid ? 'bg-accent' : 'bg-border'
            }`}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold ${isValid ? 'text-white' : 'text-ink-faint'}`}>
                Finalizar cadastro
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
