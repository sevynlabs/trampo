import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../../src/lib/trpc';
import { GradientButton } from '../../../src/components/GradientButton';
import { centsToInput, parseMoneyToCents } from '../../../src/lib/format';

export default function EditTaskScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id: id! });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Prefill once; a background refetch must not overwrite what the user typed
  const prefilled = useRef(false);
  useEffect(() => {
    if (task && !prefilled.current) {
      prefilled.current = true;
      setTitle(task.title);
      setDescription(task.description ?? '');
      setValue(centsToInput(task.baseValue));
      setIsUrgent(task.isUrgent);
    }
  }, [task]);

  const update = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: id! });
      utils.tasks.listMine.invalidate();
      Alert.alert('Pronto', 'Trampo atualizado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const cents = parseMoneyToCents(value);
  const validationMessage =
    title.trim().length < 5
      ? 'O título precisa ter pelo menos 5 caracteres'
      : !Number.isFinite(cents) || cents < 5000
        ? 'O valor mínimo é R$ 50,00'
        : cents > 10_000_000
          ? 'O valor máximo é R$ 100.000,00'
          : null;
  const valid = validationMessage === null;

  const handleSave = () => {
    if (!valid) return;
    update.mutate({
      id: id!,
      title: title.trim(),
      description: description.trim() || undefined,
      baseValue: cents,
      isUrgent,
    });
  };

  const isOpen = task?.status === 'OPEN';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Editar trampo',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="close" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        {isLoading || !task ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#FF6A00" />
          </View>
        ) : !isOpen ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="lock-closed-outline" size={48} color="#9AA5B8" />
            <Text className="text-ink font-bold text-lg mt-4 text-center">
              Não dá mais para editar
            </Text>
            <Text className="text-ink-muted text-center mt-2">
              Só é possível editar trampos que ainda estão abertos (sem profissional).
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            <Text className="text-ink font-medium mb-2">Título</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Limpeza de apartamento 2 quartos"
              placeholderTextColor="#9AA5B8"
              className="bg-surface border border-border rounded-button px-4 py-4 text-ink mb-6"
            />

            <Text className="text-ink font-medium mb-2">
              Descrição <Text className="text-ink-muted font-normal">(opcional)</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o serviço com mais detalhes..."
              placeholderTextColor="#9AA5B8"
              multiline
              maxLength={1000}
              className="bg-surface border border-border rounded-card px-4 py-4 text-ink min-h-[120px] mb-6"
              textAlignVertical="top"
            />

            <Text className="text-ink font-medium mb-2">Valor</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-button px-4 mb-1">
              <Text className="text-ink-muted font-bold">R$</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder="50,00"
                placeholderTextColor="#9AA5B8"
                className="flex-1 py-4 ml-2 text-ink text-lg"
              />
            </View>
            <Text className="text-ink-faint text-xs mb-6">Mínimo R$ 50,00</Text>

            <View className="flex-row items-center justify-between bg-surface border border-border rounded-card p-4 mb-8">
              <View className="flex-1 mr-3">
                <Text className="text-ink font-medium">Urgente (menos de 1h)</Text>
                <Text className="text-ink-muted text-sm mt-0.5">
                  Acréscimo de 30% para prioridade
                </Text>
              </View>
              <Switch
                value={isUrgent}
                onValueChange={setIsUrgent}
                trackColor={{ true: '#FF6A00', false: '#E6EBF2' }}
              />
            </View>

            {validationMessage && (
              <Text className="text-danger text-sm mb-3">{validationMessage}</Text>
            )}
            <GradientButton
              label="Salvar alterações"
              onPress={handleSave}
              disabled={!valid}
              loading={update.isPending}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
