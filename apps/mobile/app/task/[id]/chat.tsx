import { useState, useRef, useEffect } from 'react';
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

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const { data: me } = trpc.profiles.getMe.useQuery();
  const {
    data: messages,
    isLoading,
    refetch,
  } = trpc.chat.listByTask.useQuery(
    { taskId: id!, limit: 100 },
    { refetchInterval: 5000 } // Poll every 5s (TODO: use Supabase Realtime)
  );

  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage('');
      refetch();
    },
  });

  useEffect(() => {
    // Scroll to bottom when messages change
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({ taskId: id!, content: message.trim() });
  };

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
          ) : !messages?.items?.length ? (
            <View className="items-center py-8">
              <Ionicons name="chatbubbles-outline" size={48} color="#A1A1AA" />
              <Text className="text-ink-muted mt-4 text-center">
                Nenhuma mensagem ainda.{'\n'}Comece a conversa!
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {messages.items.map((msg) => {
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
