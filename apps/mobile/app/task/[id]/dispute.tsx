import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../../src/lib/trpc';
import { GradientButton } from '../../../src/components/GradientButton';

const MIN_REASON = 10;

export default function DisputeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState('');

  const { data: task } = trpc.tasks.getById.useQuery({ id: id! });
  const utils = trpc.useUtils();

  const openDispute = trpc.disputes.open.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: id! });
      utils.tasks.listMine.invalidate();
      utils.tasks.listAssigned.invalidate();
      utils.payments.getStatus.invalidate({ taskId: id! });
      Alert.alert(
        'Disputa aberta',
        'Nossa equipe vai analisar o caso. O pagamento ficará retido até a resolução.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error) => {
      Alert.alert('Erro', error.message);
    },
  });

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      Alert.alert('Atenção', `Descreva o problema com pelo menos ${MIN_REASON} caracteres.`);
      return;
    }
    openDispute.mutate({ taskId: id!, reason: trimmed });
  };

  const canSubmit = reason.trim().length >= MIN_REASON;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Abrir disputa',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="close" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
        className="flex-1"
      >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Task info */}
        <View className="bg-surface rounded-card border border-border p-4 mb-6">
          <Text className="text-ink-muted text-sm">Trampo em disputa:</Text>
          <Text className="font-bold text-ink mt-1">{task?.title}</Text>
        </View>

        {/* Warning banner */}
        <View className="flex-row gap-3 bg-amber-50 border border-amber-200 rounded-card p-4 mb-6">
          <Ionicons name="warning-outline" size={22} color="#F59E0B" />
          <Text className="flex-1 text-amber-800 text-sm">
            Abra uma disputa apenas se houver um problema sério com o trampo. O pagamento
            ficará retido até nossa equipe analisar e resolver o caso.
          </Text>
        </View>

        {/* Reason */}
        <Text className="font-display text-lg font-bold text-ink mb-3">
          O que aconteceu?
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Descreva o problema com o máximo de detalhes possível..."
          multiline
          maxLength={1000}
          className="bg-surface border border-border rounded-card p-4 text-ink min-h-[160px] mb-2"
          textAlignVertical="top"
        />
        <View className="flex-row justify-between mb-8">
          <Text className="text-ink-muted text-xs">
            {reason.trim().length < MIN_REASON
              ? `Mínimo de ${MIN_REASON} caracteres`
              : ' '}
          </Text>
          <Text className="text-ink-muted text-xs">{reason.trim().length}/1000</Text>
        </View>

        {/* Submit */}
        <GradientButton
          label="Abrir disputa"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={openDispute.isPending}
          variant="danger"
          icon="alert-circle-outline"
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
