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

const TAGS = [
  'Pontual',
  'Caprichoso',
  'Comunicativo',
  'Recomendo',
  'Profissional',
  'Atencioso',
  'Rapido',
  'Educado',
] as const;

// Tag values come from the API enum; this is just how they're shown
const TAG_LABELS: Record<string, string> = { Rapido: 'Rápido' };

export default function ReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: task } = trpc.tasks.getById.useQuery({ id: id! });
  const utils = trpc.useUtils();

  const submitReview = trpc.reviews.submit.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: id! });
      Alert.alert('Obrigado!', 'Sua avaliação foi enviada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      Alert.alert('Erro', error.message);
    },
  });

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else if (selectedTags.length < 4) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Atenção', 'Selecione uma nota de 1 a 5 estrelas.');
      return;
    }

    submitReview.mutate({
      taskId: id!,
      rating,
      comment: comment.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags as any : undefined,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Avaliar',
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
          <Text className="text-ink-muted text-sm">Avaliando trampo:</Text>
          <Text className="font-bold text-ink mt-1">{task?.title}</Text>
        </View>

        {/* Star rating */}
        <Text className="font-display text-lg font-bold text-ink mb-3">
          Como foi a experiência?
        </Text>
        <View className="flex-row justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setRating(star)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Nota ${star} de 5`}
              accessibilityState={{ selected: star === rating }}
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={40}
                color={star <= rating ? '#FF6A00' : '#FFC59E'}
              />
            </Pressable>
          ))}
        </View>

        {/* Tags */}
        <Text className="font-display text-lg font-bold text-ink mb-3">
          O que você destacaria? <Text className="font-normal text-ink-muted">(até 4)</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {TAGS.map((tag) => {
            const selected = selectedTags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full border ${
                  selected
                    ? 'bg-accent border-accent'
                    : 'bg-surface border-border'
                }`}
              >
                <Text className={selected ? 'text-white font-medium' : 'text-ink'}>
                  {TAG_LABELS[tag] ?? tag}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Comment */}
        <Text className="font-display text-lg font-bold text-ink mb-3">
          Deixe um comentário <Text className="font-normal text-ink-muted">(opcional)</Text>
        </Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Conte como foi trabalhar com essa pessoa..."
          multiline
          maxLength={500}
          className="bg-surface border border-border rounded-card p-4 text-ink min-h-[120px] mb-8"
          textAlignVertical="top"
        />

        {/* Submit */}
        <GradientButton
          label="Enviar avaliação"
          onPress={handleSubmit}
          disabled={rating === 0}
          loading={submitReview.isPending}
          icon="star"
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
