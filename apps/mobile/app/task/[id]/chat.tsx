import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../../src/lib/trpc';
import { subscribeToChatMessages } from '../../../src/lib/supabase';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  // Native stack header: 44pt bar below the status bar (iOS only matters here)
  const headerHeight = insets.top + 44;

  const { data: me } = trpc.profiles.getMe.useQuery();

  // Fetch initial messages (no polling - we use Realtime now)
  const {
    data: initialMessages,
    isLoading,
    refetch,
  } = trpc.chat.listByTask.useQuery(
    { taskId: id!, limit: 100 },
    { enabled: !!id }
  );

  // Sync initial messages to local state
  useEffect(() => {
    if (initialMessages?.items) {
      // Convert Date objects to ISO strings
      const messages = initialMessages.items.map((m) => ({
        ...m,
        createdAt: typeof m.createdAt === 'string' ? m.createdAt : m.createdAt.toISOString(),
      }));
      setLocalMessages(messages);
    }
  }, [initialMessages]);

  // Realtime only tells us "there's a new message"; fetch it from the API
  const localIdsRef = useRef(new Set<string>());
  useEffect(() => {
    localIdsRef.current = new Set(localMessages.map((m) => m.id));
  }, [localMessages]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToChatMessages(id, (messageId) => {
      if (!localIdsRef.current.has(messageId)) {
        refetch();
      }
    });
    return unsubscribe;
  }, [id, refetch]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [localMessages]);

  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: (sent) => {
      setMessage('');
      // Show our own message right away, even if Realtime is down
      setLocalMessages((prev) =>
        prev.some((m) => m.id === sent.id)
          ? prev
          : [
              ...prev,
              {
                id: sent.id,
                senderId: sent.senderId,
                content: sent.content,
                createdAt:
                  typeof sent.createdAt === 'string'
                    ? sent.createdAt
                    : new Date(sent.createdAt).toISOString(),
                sender: sent.sender,
              },
            ]
      );
    },
    onError: (err) => {
      Alert.alert('Mensagem não enviada', err.message);
      refetch();
    },
  });

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    sendMessage.mutate({ taskId: id!, content: message.trim() });
  }, [message, id, sendMessage]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Chat',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              className="mr-4"
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Ionicons name="arrow-back" size={24} color="#001B48" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background"
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        >
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#018ABE" />
            </View>
          ) : localMessages.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="chatbubbles-outline" size={48} color="#94B2C4" />
              <Text className="text-ink-muted mt-4 text-center">
                Nenhuma mensagem ainda.{'\n'}Comece a conversa!
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {localMessages.map((msg) => {
                const isMe = msg.senderId === me?.id;
                return (
                  <View
                    key={msg.id}
                    className={`max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}
                  >
                    <View
                      className={`px-4 py-3 rounded-2xl ${
                        isMe
                          ? 'bg-accent rounded-br-sm'
                          : 'bg-surface border border-border rounded-bl-sm'
                      }`}
                    >
                      <Text className={isMe ? 'text-white' : 'text-ink'}>
                        {msg.content}
                      </Text>
                    </View>
                    <Text
                      className={`text-xs text-ink-muted mt-1 ${
                        isMe ? 'text-right' : 'text-left'
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View
          className="bg-surface border-t border-border px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) + 4 }}
        >
          <View className="flex-row items-center gap-2">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Digite sua mensagem..."
              placeholderTextColor="#5B7A91"
              multiline
              maxLength={500}
              className="flex-1 bg-background border border-border rounded-button px-4 py-3 text-ink max-h-[100px]"
            />
            <Pressable
              onPress={handleSend}
              disabled={!message.trim() || sendMessage.isPending}
              accessibilityRole="button"
              accessibilityLabel="Enviar mensagem"
              className={`p-3 rounded-button ${
                message.trim() ? 'bg-accent' : 'bg-border'
              }`}
            >
              {sendMessage.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={message.trim() ? '#fff' : '#94B2C4'}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
