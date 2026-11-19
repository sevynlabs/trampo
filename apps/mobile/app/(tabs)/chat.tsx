import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../src/lib/trpc';
import { SkeletonCard } from '../../src/components/Skeleton';
import { EmptyState, EmptyInboxIllustration } from '../../src/components/illustrations';
import { Avatar, StatusBadge, colors } from '../../src/components/ds';

function when(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** "Mensagens": one conversation per accepted order. */
export default function ChatInbox() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isRefetching } = trpc.chat.conversations.useQuery();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <Text style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12, fontSize: 24, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
        Mensagens
      </Text>
      {isLoading ? (
        <View style={{ paddingHorizontal: 20 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} index={i} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(c) => c.taskId}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.hairline, marginLeft: 88 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/task/${item.taskId}/chat`)}
              accessibilityRole="button"
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: pressed ? '#fff' : 'transparent' }]}
            >
              <Avatar name={item.other?.name} uri={item.other?.avatarUrl} size={54} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15.5, fontWeight: '800', color: colors.ink }}>
                    {item.other?.name ?? 'Profissional'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.inkMuted }}>{when(item.sortAt)}</Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.orange, fontWeight: '600', marginTop: 1 }}>
                  {item.taskTitle}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 13.5, color: colors.inkMuted, marginTop: 2 }}>
                  {item.lastMessage ? `${item.lastMessage.mine ? 'Você: ' : ''}${item.lastMessage.content}` : 'Nenhuma mensagem ainda'}
                </Text>
              </View>
              <View style={{ marginLeft: 8 }}>
                <StatusBadge status={item.status} />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              illustration={EmptyInboxIllustration}
              title={isError ? 'Não foi possível carregar' : 'Nenhuma conversa ainda'}
              subtitle={
                isError
                  ? 'Puxe para baixo para tentar de novo.'
                  : 'O chat abre quando um profissional confirma o seu pedido.'
              }
            />
          }
        />
      )}
    </View>
  );
}
