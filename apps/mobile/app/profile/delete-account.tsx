import { useState } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { trpc, clearTokens } from '../../src/lib/trpc';
import { ScreenHeader, Card, Button, colors } from '../../src/components/ds';

const ERASED = [
  'Nome, telefone, e-mail e foto',
  'CPF e documentos de identidade',
  'Chave Pix e dados de profissional',
  'Notificações e acesso ao app',
];
const KEPT = [
  'Histórico de pedidos e pagamentos, sem o seu nome (exigência fiscal)',
  'Avaliações feitas, como “Usuário excluído”',
];

/** Account deletion (App Store 5.1.1(v) / Google Play requirement). */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const check = trpc.profiles.deletionCheck.useQuery();
  const del = trpc.profiles.deleteAccount.useMutation({
    onSuccess: async () => {
      await clearTokens();
      queryClient.clear();
      router.replace('/');
    },
    onError: (err) => setError(err.message),
  });

  const blockers = check.data?.blockers ?? [];
  const ready = confirm.trim().toUpperCase() === 'EXCLUIR';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Excluir conta" paddingTop={insets.top} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
          A exclusão é definitiva. Depois dela você não consegue entrar de novo nesta conta. Se quiser usar o Trampo outra vez, pode criar uma
          conta nova com o mesmo número.
        </Text>

        <Card>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 8 }}>O que será apagado</Text>
          {ERASED.map((t) => (
            <Row key={t} icon="trash-outline" color={colors.danger} text={t} />
          ))}
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 10, marginBottom: 8 }}>O que fica guardado</Text>
          {KEPT.map((t) => (
            <Row key={t} icon="document-lock-outline" color={colors.inkMuted} text={t} />
          ))}
        </Card>

        {check.isLoading ? (
          <ActivityIndicator color={colors.orange} />
        ) : blockers.length > 0 ? (
          <Card style={{ backgroundColor: colors.warningSoft }}>
            <Text style={{ fontWeight: '800', color: colors.ink, marginBottom: 6 }}>Antes de excluir</Text>
            {blockers.map((b) => (
              <Row key={b.code} icon="alert-circle-outline" color="#B45309" text={b.message} />
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>
              Para confirmar, digite <Text style={{ color: colors.danger }}>EXCLUIR</Text>
            </Text>
            <TextInput
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                setError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="EXCLUIR"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel="Digite EXCLUIR para confirmar"
              style={{ height: 50, borderWidth: 1.5, borderColor: colors.input, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: colors.ink }}
            />
            {!!error && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}
            <Button
              label="Excluir minha conta"
              variant="danger"
              icon="trash-outline"
              disabled={!ready}
              loading={del.isPending}
              onPress={() => del.mutate({ confirm: 'EXCLUIR' })}
              style={{ marginTop: 14 }}
            />
          </Card>
        )}

        <Button label="Manter minha conta" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{text}</Text>
    </View>
  );
}
