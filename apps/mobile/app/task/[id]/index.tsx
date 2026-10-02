import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../../src/lib/trpc';
import { formatCurrency } from '../../../src/lib/format';

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

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; description: string; color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  PENDING: {
    label: 'Aguardando pagamento',
    description: 'O cliente ainda não pagou o Pix.',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    icon: 'time-outline',
  },
  CONFIRMED: {
    label: 'Pagamento confirmado',
    description: 'O valor está garantido e protegido.',
    color: 'text-success',
    bgColor: 'bg-success/10',
    icon: 'shield-checkmark-outline',
  },
  HELD: {
    label: 'Pagamento retido',
    description: 'Será liberado ao profissional após a conclusão.',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    icon: 'lock-closed-outline',
  },
  RELEASED: {
    label: 'Pagamento liberado',
    description: 'O valor foi liberado ao profissional.',
    color: 'text-success',
    bgColor: 'bg-success/10',
    icon: 'checkmark-done-outline',
  },
  REFUNDED: {
    label: 'Reembolsado',
    description: 'O valor foi devolvido ao cliente.',
    color: 'text-ink-muted',
    bgColor: 'bg-border/40',
    icon: 'arrow-undo-outline',
  },
  DISPUTED: {
    label: 'Em disputa',
    description: 'O pagamento está retido até a resolução.',
    color: 'text-danger',
    bgColor: 'bg-danger/10',
    icon: 'alert-circle-outline',
  },
  EXPIRED: {
    label: 'Pix expirado',
    description: 'A cobrança expirou sem pagamento.',
    color: 'text-danger',
    bgColor: 'bg-danger/10',
    icon: 'close-circle-outline',
  },
};

// Mirrors the server rule: free up to 30 min before the scheduled time,
// 20% of the total after that (only once a tasker accepted).
const FREE_CANCEL_MINUTES = 30;
const CANCEL_PENALTY_RATE = 0.2;

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-4"
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
    >
      <Ionicons name="arrow-back" size={24} color="#001B48" />
    </Pressable>
  );
}

export default function TaskDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: task,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = trpc.tasks.getById.useQuery({ id: id! });
  const { data: me } = trpc.profiles.getMe.useQuery();

  const utils = trpc.useUtils();

  // Anything that changes a task's status must refresh every list showing it
  const refreshTaskEverywhere = () => {
    refetch();
    utils.tasks.listMine.invalidate();
    utils.tasks.listAssigned.invalidate();
    utils.payments.getStatus.invalidate({ taskId: id! });
  };

  const acceptTask = trpc.matching.accept.useMutation({
    onSuccess: () => {
      refreshTaskEverywhere();
      utils.feed.nearby.invalidate();
    },
    onError: (err) => {
      Alert.alert('Erro', err.message);
      refetch();
    },
  });

  const startTask = trpc.matching.start.useMutation({
    onSuccess: refreshTaskEverywhere,
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const completeTask = trpc.matching.complete.useMutation({
    onSuccess: refreshTaskEverywhere,
    onError: (err) => Alert.alert('Erro', err.message),
  });

  const cancelTask = trpc.matching.cancel.useMutation({
    onSuccess: (result) => {
      refreshTaskEverywhere();
      utils.feed.nearby.invalidate();
      Alert.alert(
        'Pronto',
        result.penalty > 0
          ? `Trampo cancelado. Taxa de cancelamento: ${formatCurrency(result.penalty)}.`
          : 'Trampo cancelado.'
      );
      router.back();
    },
    onError: (err) => Alert.alert('Erro', err.message),
  });

  // Payment status — only fetched for parties once a charge can exist.
  const isParty = !!me && (task?.clientId === me.id || task?.assignment?.taskerId === me.id);
  const { data: payment } = trpc.payments.getStatus.useQuery(
    { taskId: id! },
    { enabled: !!id && !!task && isParty && task.status !== 'OPEN' }
  );

  if (isError || (!isLoading && !task)) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Detalhes',
            headerLeft: () => <BackButton onPress={() => router.back()} />,
          }}
        />
        <View className="flex-1 bg-background items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#5B7A91" />
          <Text className="text-ink font-semibold text-lg mt-3 text-center">
            Não foi possível abrir este trampo
          </Text>
          <Text className="text-ink-muted mt-1 text-center">
            {error?.message ?? 'Ele pode ter sido removido.'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            disabled={isRefetching}
            className="mt-6 px-6 py-3 rounded-button bg-accent/10"
            accessibilityRole="button"
          >
            <Text className="text-accent font-bold">
              {isRefetching ? 'Carregando...' : 'Tentar novamente'}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (isLoading || !task) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Detalhes',
            headerLeft: () => <BackButton onPress={() => router.back()} />,
          }}
        />
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator size="large" color="#018ABE" />
        </View>
      </>
    );
  }

  const isClient = task.clientId === me?.id;
  const isTasker = task.assignment?.taskerId === me?.id;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.OPEN;

  const canPay =
    isClient &&
    task.status === 'ACCEPTED' &&
    (!payment || payment.status === 'PENDING' || payment.status === 'EXPIRED');
  const canAccept = !isClient && task.status === 'OPEN' && me?.role !== 'CLIENT';
  const canStart = isTasker && task.status === 'ACCEPTED';
  const canComplete = isTasker && task.status === 'IN_PROGRESS';
  // Clients cancel; a tasker can only give up an accepted task (it reopens)
  const canCancel =
    (isClient && ['OPEN', 'ACCEPTED'].includes(task.status)) ||
    (isTasker && task.status === 'ACCEPTED');
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
    if (isTasker) {
      Alert.alert(
        'Desistir do trampo',
        'O trampo volta para o feed e outro profissional poderá aceitá-lo.',
        [
          { text: 'Voltar', style: 'cancel' },
          {
            text: 'Desistir',
            style: 'destructive',
            onPress: () => cancelTask.mutate({ taskId: task.id }),
          },
        ]
      );
      return;
    }

    const minutesLeft = task.scheduledAt
      ? (new Date(task.scheduledAt).getTime() - Date.now()) / 60000
      : Infinity;
    const penalty =
      task.status === 'ACCEPTED' && minutesLeft < FREE_CANCEL_MINUTES
        ? Math.round(task.totalValue * CANCEL_PENALTY_RATE)
        : 0;

    Alert.alert(
      'Cancelar trampo',
      penalty > 0
        ? `Faltam menos de ${FREE_CANCEL_MINUTES} minutos para o horário marcado. Será cobrada uma taxa de ${formatCurrency(penalty)} (20%).`
        : 'O cancelamento é gratuito. Se você já pagou, o valor será estornado.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar trampo',
          style: 'destructive',
          onPress: () => cancelTask.mutate({ taskId: task.id }),
        },
      ]
    );
  };

  const hasActions =
    canChat || canPay || canAccept || canStart || canComplete || canCancel || canReview || canDispute;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Detalhes',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => <BackButton onPress={() => router.back()} />,
          headerRight: () =>
            isClient && task.status === 'OPEN' ? (
              <Pressable
                onPress={() => router.push(`/task/${task.id}/edit`)}
                className="ml-4"
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Editar trampo"
              >
                <Ionicons name="create-outline" size={22} color="#018ABE" />
              </Pressable>
            ) : null,
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
              <View className="bg-warning/15 px-2 py-1 rounded-chip ml-2">
                <Text className="text-xs font-bold" style={{ color: '#92400E' }}>
                  Urgente
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {task.description && (
            <Text className="text-ink-soft mb-6">{task.description}</Text>
          )}

          {/* Address */}
          <View className="flex-row items-start mb-6">
            <Ionicons name="location-outline" size={20} color="#5B7A91" />
            <Text className="text-ink-soft flex-1 ml-2">{task.address}</Text>
          </View>

          {/* Client info */}
          <View className="bg-surface rounded-card border border-border p-4 mb-6">
            <Text className="text-ink-muted text-sm mb-2">
              {isClient ? 'Você criou este serviço' : 'Solicitado por'}
            </Text>
            {!isClient && task.client && (
              <Pressable
                onPress={() => router.push(`/user/${task.client.id}`)}
                className="flex-row items-center"
              >
                <View className="w-10 h-10 bg-accent/10 rounded-full items-center justify-center">
                  <Text className="text-accent font-bold">
                    {task.client.name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <Text className="text-ink font-medium flex-1 ml-3">{task.client.name}</Text>
                <Ionicons name="chevron-forward" size={18} color="#94B2C4" />
              </Pressable>
            )}
            {isClient && task.assignment?.tasker && (
              <Pressable
                onPress={() => router.push(`/user/${task.assignment!.tasker.id}`)}
                className="flex-row items-center mt-3 pt-3 border-t border-border"
              >
                <View className="w-10 h-10 bg-accent/10 rounded-full items-center justify-center">
                  <Text className="text-accent font-bold">
                    {task.assignment.tasker.name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-ink-muted text-xs">Profissional</Text>
                  <Text className="text-ink font-medium">{task.assignment.tasker.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94B2C4" />
              </Pressable>
            )}
          </View>

          {/* Payment status */}
          {payment && PAYMENT_STATUS_CONFIG[payment.status] && (
            <View
              className={`rounded-card p-4 mb-6 ${PAYMENT_STATUS_CONFIG[payment.status].bgColor}`}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={PAYMENT_STATUS_CONFIG[payment.status].icon}
                  size={22}
                  color="#5B7A91"
                />
                <View className="flex-1 ml-3">
                  <Text className={`font-bold ${PAYMENT_STATUS_CONFIG[payment.status].color}`}>
                    {PAYMENT_STATUS_CONFIG[payment.status].label}
                  </Text>
                  <Text className="text-ink-muted text-sm mt-0.5">
                    {PAYMENT_STATUS_CONFIG[payment.status].description}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Price breakdown: the client sees what they pay, the tasker what they get */}
          <View className="bg-surface rounded-card border border-border p-4">
            <Text className="text-ink font-medium mb-3">Valores</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-ink-muted">Valor base</Text>
              <Text className="text-ink">{formatCurrency(task.baseValue)}</Text>
            </View>
            {task.urgencyFee > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-ink-muted">Taxa de urgência</Text>
                <Text className="text-ink">+{formatCurrency(task.urgencyFee)}</Text>
              </View>
            )}
            {isClient ? (
              <View className="flex-row justify-between mb-3">
                <Text className="text-ink-muted">Taxa de serviço (5%)</Text>
                <Text className="text-ink-muted">+{formatCurrency(task.serviceFee)}</Text>
              </View>
            ) : (
              <View className="flex-row justify-between mb-3">
                <Text className="text-ink-muted">Comissão TRAMPO (15%)</Text>
                <Text className="text-ink-muted">
                  -{formatCurrency(task.baseValue + task.urgencyFee - task.taskerValue)}
                </Text>
              </View>
            )}
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
      {hasActions && (
      <View
        className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border p-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
      >
        <View className="flex-row gap-3">
          {canChat && (
            <Link href={`/task/${task.id}/chat`} asChild>
              <Pressable className="flex-1 bg-border py-4 rounded-button items-center flex-row justify-center">
                <Ionicons name="chatbubble-outline" size={20} color="#5B7A91" />
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
              accessibilityRole="button"
            >
              {cancelTask.isPending ? (
                <ActivityIndicator color="#E11D48" />
              ) : (
                <Text className="text-danger font-bold">{isTasker ? 'Desistir' : 'Cancelar'}</Text>
              )}
            </Pressable>
          )}

          {canReview && (
            <Link href={`/task/${task.id}/review`} asChild>
              <Pressable className="flex-1 bg-accent py-4 rounded-button items-center flex-row justify-center">
                <Ionicons name="star" size={20} color="#fff" />
                <Text className="text-white font-bold ml-2">Avaliar</Text>
              </Pressable>
            </Link>
          )}
        </View>

        {canDispute && (
          <Link href={`/task/${task.id}/dispute`} asChild>
            <Pressable className="mt-3 py-2 items-center flex-row justify-center">
              <Ionicons name="alert-circle-outline" size={16} color="#E11D48" />
              <Text className="text-danger text-sm ml-1">Tive um problema com este trampo</Text>
            </Pressable>
          </Link>
        )}
      </View>
      )}
    </>
  );
}
