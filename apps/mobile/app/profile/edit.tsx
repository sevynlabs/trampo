import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../src/lib/trpc';

export default function EditProfileScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: user, isLoading } = trpc.profiles.getMe.useQuery();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Prefill once the profile loads.
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
    }
  }, [user]);

  const updateProfile = trpc.profiles.updateBasicProfile.useMutation({
    onSuccess: () => {
      utils.profiles.getMe.invalidate();
      Alert.alert('Pronto', 'Perfil atualizado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const emailValid = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = name.trim().length >= 2 && emailValid;

  const handleSave = () => {
    if (!isValid) return;
    updateProfile.mutate({ name: name.trim(), email: email.trim() });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Editar perfil',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#18181B" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Name */}
            <Text className="text-ink font-medium mb-2">Nome completo</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Como você quer ser chamado"
              autoCapitalize="words"
              className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-6"
            />

            {/* Email */}
            <Text className="text-ink font-medium mb-2">
              E-mail <Text className="text-ink-muted font-normal">(opcional)</Text>
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-2"
            />
            {!emailValid && (
              <Text className="text-danger text-sm mb-4">E-mail inválido</Text>
            )}

            {/* Read-only phone */}
            <Text className="text-ink font-medium mb-2 mt-4">Telefone</Text>
            <View className="bg-border/40 border border-border rounded-button px-4 py-4 mb-1">
              <Text className="text-ink-muted">{user?.phone}</Text>
            </View>
            <Text className="text-ink-faint text-xs mb-8">
              Telefone e CPF não podem ser alterados.
            </Text>

            {/* Save */}
            <Pressable
              onPress={handleSave}
              disabled={!isValid || updateProfile.isPending}
              className={`w-full py-4 rounded-button items-center ${
                isValid ? 'bg-accent' : 'bg-border'
              }`}
            >
              {updateProfile.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className={`font-bold ${isValid ? 'text-white' : 'text-ink-faint'}`}>
                  Salvar alterações
                </Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
