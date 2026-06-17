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
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
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

  // Subscribe to Realtime messages
  useEffect(() => {
    if (!id) return;

    console.log('[CHAT] Subscribing to realtime messages');

    const unsubscribe = subscribeToChatMessages(id, (newMessage) => {
      console.log('[CHAT] Received realtime message:', newMessage.id);

      // Add message to local state if not already present
      setLocalMessages((prev) => {
        // Check if message already exists
        if (prev.some((m) => m.id === newMessage.id)) {
          return prev;
        }

        // Add new message
        return [
          ...prev,
          {
            id: newMessage.id,
            senderId: newMessage.senderId,
            content: newMessage.content,
            createdAt: newMessage.createdAt,
            sender: {
              id: newMessage.senderId,
              name: newMessage.senderName,
              avatarUrl: newMessage.senderAvatar,
            },
          },
        ];
      });
    });

    return () => {
      console.log('[CHAT] Unsubscribing from realtime');
      unsubscribe();
    };
  }, [id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [localMessages]);

  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage('');
      // No need to refetch - Realtime will deliver the message
    },
    onError: () => {
      // On error, refetch to ensure consistency
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
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#18181B" />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        >
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#2563EB" />
            </View>
          ) : localMessages.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="chatbubbles-outline" size={48} color="#A1A1AA" />
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
                      className={`text-xs text-ink-faint mt-1 ${
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
        <View className="bg-surface border-t border-border px-4 py-3 pb-6">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Digite sua mensagem..."
              multiline
              maxLength={500}
              className="flex-1 bg-background border border-border rounded-button px-4 py-3 text-ink max-h-[100px]"
            />
            <Pressable
              onPress={handleSend}
              disabled={!message.trim() || sendMessage.isPending}
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
                  color={message.trim() ? '#fff' : '#A1A1AA'}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
