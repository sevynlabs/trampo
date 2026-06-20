import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../../src/lib/trpc';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  OPEN: { label: 'Aberto', color: 'text-accent', bgColor: 'bg-accent/10' },
  ACCEPTED: { label: 'Aceito', color: 'text-warning', bgColor: 'bg-warning/10' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-warning', bgColor: 'bg-warning/10' },
  COMPLETED: { label: 'Concluído', color: 'text-success', bgColor: 'bg-success/10' },
  RELEASED: { label: 'Finalizado', color: 'text-success', bgColor: 'bg-success/10' },
  CANCELLED: { label: 'Cancelado', color: 'text-danger', bgColor: 'bg-danger/10' },
  DISPUTED: { label: 'Em disputa', color: 'text-danger', bgColor: 'bg-danger/10' },
};

function formatCurrency(centavos: number) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: task, isLoading, refetch } = trpc.tasks.getById.useQuery({ id: id! });
  const { data: me } = trpc.profiles.getMe.useQuery();

  const utils = trpc.useUtils();

  const acceptTask = trpc.matching.accept.useMutation({
    onSuccess: () => {
      refetch();
      utils.tasks.listMine.invalidate();
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const startTask = trpc.matching.start.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const completeTask = trpc.matching.complete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const cancelTask = trpc.matching.cancel.useMutation({
    onSuccess: () => {
      refetch();
      router.back();
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  if (isLoading || !task) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const isClient = task.clientId === me?.id;
  const isTasker = task.assignment?.taskerId === me?.id;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.OPEN;

  const canPay = isClient && task.status === 'ACCEPTED';
  const canAccept = !isClient && task.status === 'OPEN' && me?.role !== 'CLIENT';
  const canStart = isTasker && task.status === 'ACCEPTED';
  const canComplete = isTasker && task.status === 'IN_PROGRESS';
  const canCancel = (isClient || isTasker) && ['OPEN', 'ACCEPTED'].includes(task.status);
  const canChat = (isClient || isTasker) && task.status !== 'OPEN' && task.status !== 'CANCELLED';
  const canReview = (isClient || isTasker) && ['COMPLETED', 'RELEASED'].includes(task.status);
  const canDispute =
    (isClient || isTasker) && ['IN_PROGRESS', 'COMPLETED'].includes(task.status);

  const handleAccept = () => {
    Alert.alert(
      'Aceitar serviço',
      `Você receberá ${formatCurrency(task.taskerValue)} por este serviço. Confirmar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceitar', onPress: () => acceptTask.mutate({ taskId: task.id }) },
      ]
    );
  };

  const handleStart = () => {
    Alert.alert('Iniciar serviço', 'Você está no local e vai começar o trabalho?', [
      { text: 'Ainda não', style: 'cancel' },
      { text: 'Iniciar', onPress: () => startTask.mutate({ taskId: task.id }) },
    ]);
  };

  const handleComplete = () => {
    Alert.alert('Concluir serviço', 'Você finalizou o trabalho?', [
      { text: 'Ainda não', style: 'cancel' },
      { text: 'Concluir', onPress: () => completeTask.mutate({ taskId: task.id }) },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar serviço',
      'Tem certeza? Pode haver cobrança de taxa de cancelamento.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar serviço',
          style: 'destructive',
          onPress: () => cancelTask.mutate({ taskId: task.id }),
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Detalhes',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#18181B" />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Status */}
        <View className={`px-6 py-4 ${status.bgColor}`}>
          <Text className={`font-bold ${status.color}`}>{status.label}</Text>
        </View>

        <View className="p-6">
          {/* Title & category */}
          <Text className="font-display text-2xl font-bold text-ink mb-2">
            {task.title}
          </Text>
          <View className="flex-row items-center mb-4">
            <Text className="text-ink-muted">{task.category.name}</Text>
            {task.isUrgent && (
              <View className="bg-warning px-2 py-1 rounded-chip ml-2">
                <Text className="text-white text-xs font-medium">Urgente</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {task.description && (
            <Text className="text-ink-soft mb-6">{task.description}</Text>
          )}

          {/* Address */}
          <View className="flex-row items-start mb-6">
            <Ionicons name="location-outline" size={20} color="#71717A" />
            <Text className="text-ink-soft flex-1 ml-2">{task.address}</Text>
          </View>

          {/* Client info */}
          <View className="bg-surface rounded-card border border-border p-4 mb-6">
            <Text className="text-ink-muted text-sm mb-2">
              {isClient ? 'Você criou este serviço' : 'Solicitado por'}
            </Text>
            {!isClient && task.client && (
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-accent/10 rounded-full items-center justify-center">
                  <Text className="text-accent font-bold">
                    {task.client.name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View className="ml-3">
                  <Text className="text-ink font-medium">{task.client.name}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Price breakdown */}
          <View className="bg-surface rounded-card border border-border p-4">
            <Text className="text-ink font-medium mb-3">Valores</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-ink-muted">Valor base</Text>
              <Text className="text-ink">{formatCurrency(task.baseValue)}</Text>
            </View>
            {task.urgencyFee > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-ink-muted">Taxa de urgência</Text>
                <Text className="text-warning">+{formatCurrency(task.urgencyFee)}</Text>
              </View>
            )}
            <View className="flex-row justify-between mb-3">
              <Text className="text-ink-muted">Taxa de serviço</Text>
              <Text className="text-ink-muted">+{formatCurrency(task.serviceFee)}</Text>
            </View>
            <View className="flex-row justify-between pt-3 border-t border-border">
              <Text className="text-ink font-bold">
                {isClient ? 'Total a pagar' : 'Você recebe'}
              </Text>
              <Text className="text-accent font-bold text-lg">
                {formatCurrency(isClient ? task.totalValue : task.taskerValue)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border p-4 pb-8">
        <View className="flex-row gap-3">
          {canChat && (
            <Link href={`/task/${task.id}/chat`} asChild>
              <Pressable className="flex-1 bg-border py-4 rounded-button items-center flex-row justify-center">
                <Ionicons name="chatbubble-outline" size={20} color="#52525B" />
                <Text className="text-ink-soft font-bold ml-2">Chat</Text>
              </Pressable>
            </Link>
          )}

          {canPay && (
            <Link href={`/task/${task.id}/payment`} asChild>
              <Pressable className="flex-1 bg-accent py-4 rounded-button items-center flex-row justify-center">
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
                <Text className="text-white font-bold ml-2">Pagar com Pix</Text>
              </Pressable>
            </Link>
          )}

          {canAccept && (
            <Pressable
              onPress={handleAccept}
              disabled={acceptTask.isPending}
              className="flex-1 bg-success py-4 rounded-button items-center"
            >
              {acceptTask.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">Aceitar</Text>
              )}
            </Pressable>
          )}

          {canStart && (
            <Pressable
              onPress={handleStart}
              disabled={startTask.isPending}
              className="flex-1 bg-accent py-4 rounded-button items-center"
            >
              {startTask.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">Iniciar trabalho</Text>
              )}
            </Pressable>
          )}

          {canComplete && (
            <Pressable
              onPress={handleComplete}
              disabled={completeTask.isPending}
              className="flex-1 bg-success py-4 rounded-button items-center"
            >
              {completeTask.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">Concluir</Text>
              )}
            </Pressable>
          )}

          {canCancel && (
            <Pressable
              onPress={handleCancel}
              disabled={cancelTask.isPending}
              className="bg-danger/10 py-4 px-6 rounded-button items-center"
            >
              <Text className="text-danger font-bold">Cancelar</Text>
            </Pressable>
          )}

          {canReview && (
            <Link href={`/task/${task.id}/review`} asChild>
              <Pressable className="flex-1 bg-warning py-4 rounded-button items-center flex-row justify-center">
                <Ionicons name="star" size={20} color="#fff" />
                <Text className="text-white font-bold ml-2">Avaliar</Text>
              </Pressable>
            </Link>
          )}
        </View>

        {canDispute && (
          <Link href={`/task/${task.id}/dispute`} asChild>
            <Pressable className="mt-3 py-2 items-center flex-row justify-center">
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text className="text-danger text-sm ml-1">Tive um problema com este trampo</Text>
            </Pressable>
          </Link>
        )}
      </View>
    </>
  );
}
