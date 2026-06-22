import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
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

  const openDispute = trpc.disputes.open.useMutation({
    onSuccess: () => {
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
              <Ionicons name="close" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
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
        <Text className="text-ink-muted text-xs mb-8 text-right">
          {reason.trim().length}/1000
        </Text>

        {/* Submit */}
        <GradientButton
          label="Abrir Disputa"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={openDispute.isPending}
          variant="danger"
          icon="alert-circle-outline"
        />
      </ScrollView>
    </>
  );
}
