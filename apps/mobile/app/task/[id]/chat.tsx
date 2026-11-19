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
import type { ScrollViewInstance } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../../src/lib/trpc';
import { subscribeToChatMessages } from '../../../src/lib/supabase';
import { formatCurrency } from '../../../src/lib/format';
import { Avatar, Card, IconCircle, colors, shadow } from '../../../src/components/ds';

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
  const scrollRef = useRef<ScrollViewInstance>(null);
  const insets = useSafeAreaInsets();

  const { data: me } = trpc.profiles.getMe.useQuery();
  const { data: task } = trpc.tasks.getById.useQuery({ id: id! }, { enabled: !!id });

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

  const other = task ? (task.clientId === me?.id ? task.assignment?.tasker ?? null : task.client) : null;
  const scheduled = task?.scheduledAt ? new Date(task.scheduledAt) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      {/* Navy header with the other party */}
      <View style={{ backgroundColor: colors.navy, paddingTop: insets.top + 6, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar" style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => other && router.push(`/user/${other.id}`)}
          accessibilityRole="button"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}
        >
          <Avatar name={other?.name} uri={other?.avatarUrl} size={42} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 16.5, fontWeight: '800' }}>
              {other?.name ?? 'Chat'}
            </Text>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5 }}>
              {task?.title ?? ''}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push(`/task/${id}`)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Ver pedido" style={{ padding: 4 }}>
          <Ionicons name="document-text-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color={colors.orange} />
            </View>
          ) : localMessages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.inkFaint} />
              <Text style={{ color: colors.inkMuted, marginTop: 12, textAlign: 'center' }}>
                Nenhuma mensagem ainda.{'\n'}Comece a conversa!
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {localMessages.map((msg, i) => {
                const isMe = msg.senderId === me?.id;
                const prev = localMessages[i - 1];
                const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                return (
                  <View key={msg.id}>
                    {newDay && (
                      <View style={{ alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginVertical: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkMuted }}>{dayLabel(msg.createdAt)}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && <Avatar name={msg.sender.name} uri={msg.sender.avatarUrl} size={30} />}
                      <View
                        style={{
                          maxWidth: '78%',
                          marginLeft: isMe ? 0 : 8,
                          backgroundColor: isMe ? colors.orange : '#fff',
                          borderRadius: 18,
                          borderBottomRightRadius: isMe ? 4 : 18,
                          borderBottomLeftRadius: isMe ? 18 : 4,
                          paddingHorizontal: 14,
                          paddingTop: 10,
                          paddingBottom: 6,
                          ...(isMe ? {} : shadow.card),
                        }}
                      >
                        <Text style={{ color: isMe ? '#fff' : colors.ink, fontSize: 15, lineHeight: 20 }}>{msg.content}</Text>
                        <Text style={{ alignSelf: 'flex-end', fontSize: 10.5, marginTop: 3, color: isMe ? 'rgba(255,255,255,0.85)' : colors.inkFaint }}>
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {isMe ? '  ✓✓' : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {task && ['ACCEPTED', 'IN_PROGRESS'].includes(task.status) && (
            <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' }} onPress={() => router.push(`/task/${id}`)}>
              <IconCircle icon="calendar" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '800', color: colors.ink }}>
                  {task.status === 'IN_PROGRESS' ? 'Serviço em andamento' : 'Agendamento confirmado'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.inkMuted }}>
                  {scheduled
                    ? scheduled.toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Data a combinar'}
                  {' · '}
                  {formatCurrency(task.totalValue)}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            </Card>
          )}
        </ScrollView>

        {/* Input */}
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.hairline, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Digite uma mensagem..."
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={500}
              accessibilityLabel="Mensagem"
              style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.ink, maxHeight: 110 }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!message.trim() || sendMessage.isPending}
              accessibilityRole="button"
              accessibilityLabel="Enviar mensagem"
              style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: message.trim() ? colors.orange : colors.hairline }}
            >
              {sendMessage.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={20} color={message.trim() ? '#fff' : colors.inkFaint} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}
