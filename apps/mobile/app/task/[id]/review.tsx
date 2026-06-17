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

export default function ReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: task } = trpc.tasks.getById.useQuery({ id: id! });

  const submitReview = trpc.reviews.submit.useMutation({
    onSuccess: () => {
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
              <Ionicons name="close" size={24} color="#18181B" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
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
            <Pressable key={star} onPress={() => setRating(star)}>
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={40}
                color={star <= rating ? '#EA580C' : '#D4D4D8'}
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
                  {tag}
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
        <Pressable
          onPress={handleSubmit}
          disabled={submitReview.isPending || rating === 0}
          className={`p-4 rounded-button items-center ${
            rating > 0 ? 'bg-accent' : 'bg-border'
          }`}
        >
          {submitReview.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-lg">Enviar Avaliação</Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}
