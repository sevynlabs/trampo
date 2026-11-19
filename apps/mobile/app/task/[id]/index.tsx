import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trpc } from '../../../src/lib/trpc';
import { formatCurrency } from '../../../src/lib/format';
import {
  ScreenHeader,
  Card,
  Button,
  Avatar,
  Badge,
  IconButton,
  IconCircle,
  InfoRow,
  StatusBadge,
  StatusTimeline,
  categoryIcon,
  colors,
} from '../../../src/components/ds';
import type { TimelineStep } from '../../../src/components/ds';

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  PENDING: { label: 'Aguardando pagamento', description: 'O cliente ainda não pagou o Pix.', icon: 'time-outline' },
  CONFIRMED: { label: 'Pagamento confirmado', description: 'O valor está garantido e protegido.', icon: 'shield-checkmark-outline' },
  HELD: { label: 'Pagamento retido', description: 'Será liberado ao profissional após a conclusão.', icon: 'lock-closed-outline' },
  RELEASED: { label: 'Pagamento liberado', description: 'O valor foi liberado ao profissional.', icon: 'checkmark-done-outline' },
  REFUNDED: { label: 'Reembolsado', description: 'O valor foi devolvido ao cliente.', icon: 'arrow-undo-outline' },
  DISPUTED: { label: 'Em disputa', description: 'O pagamento está retido até a resolução.', icon: 'alert-circle-outline' },
  EXPIRED: { label: 'Pix expirado', description: 'A cobrança expirou sem pagamento.', icon: 'close-circle-outline' },
};

// Mirrors the server rule: free up to 30 min before the scheduled time,
// 20% of the total after that (only once a tasker accepted).
const FREE_CANCEL_MINUTES = 30;
const CANCEL_PENALTY_RATE = 0.2;

const STEP_INDEX: Record<string, number> = { OPEN: 0, ACCEPTED: 1, IN_PROGRESS: 2, COMPLETED: 3, RELEASED: 3 };

/** "Meu pedido" (client) / "Solicitação de serviço" (professional). */
export default function TaskDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: task, isLoading, isError, error, refetch, isRefetching } = trpc.tasks.getById.useQuery({ id: id! });
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
          ? `Pedido cancelado. Taxa de cancelamento: ${formatCurrency(result.penalty)}.`
          : 'Pedido cancelado.'
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Detalhes" paddingTop={insets.top} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.inkMuted} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 12, textAlign: 'center' }}>
            Não foi possível abrir este pedido
          </Text>
          <Text style={{ color: colors.inkMuted, marginTop: 4, textAlign: 'center' }}>{error?.message ?? 'Ele pode ter sido removido.'}</Text>
          <Button
            label={isRefetching ? 'Carregando...' : 'Tentar novamente'}
            variant="outline"
            onPress={() => refetch()}
            disabled={isRefetching}
            style={{ marginTop: 20 }}
          />
        </View>
      </View>
    );
  }

  if (isLoading || !task) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Detalhes" paddingTop={insets.top} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.orange} />
        </View>
      </View>
    );
  }

  const isClient = task.clientId === me?.id;
  const isTasker = task.assignment?.taskerId === me?.id;

  const canPay =
    isClient && task.status === 'ACCEPTED' && (!payment || payment.status === 'PENDING' || payment.status === 'EXPIRED');
  const canAccept = !isClient && task.status === 'OPEN' && me?.role !== 'CLIENT';
  const canStart = isTasker && task.status === 'ACCEPTED';
  const canComplete = isTasker && task.status === 'IN_PROGRESS';
  // Clients cancel; a tasker can only give up an accepted task (it reopens)
  const canCancel = (isClient && ['OPEN', 'ACCEPTED'].includes(task.status)) || (isTasker && task.status === 'ACCEPTED');
  const canChat = (isClient || isTasker) && task.status !== 'OPEN' && task.status !== 'CANCELLED';
  const canReview = (isClient || isTasker) && ['COMPLETED', 'RELEASED'].includes(task.status);
  const canDispute = (isClient || isTasker) && ['IN_PROGRESS', 'COMPLETED'].includes(task.status);

  const handleAccept = () => {
    Alert.alert('Aceitar serviço', `Você receberá ${formatCurrency(task.taskerValue)} por este serviço. Confirmar?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceitar', onPress: () => acceptTask.mutate({ taskId: task.id }) },
    ]);
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
      Alert.alert('Desistir do serviço', 'O pedido volta para as solicitações e outro profissional poderá aceitá-lo.', [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Desistir', style: 'destructive', onPress: () => cancelTask.mutate({ taskId: task.id }) },
      ]);
      return;
    }

    const minutesLeft = task.scheduledAt ? (new Date(task.scheduledAt).getTime() - Date.now()) / 60000 : Infinity;
    const penalty =
      task.status === 'ACCEPTED' && minutesLeft < FREE_CANCEL_MINUTES ? Math.round(task.totalValue * CANCEL_PENALTY_RATE) : 0;

    Alert.alert(
      'Cancelar pedido',
      penalty > 0
        ? `Faltam menos de ${FREE_CANCEL_MINUTES} minutos para o horário marcado. Será cobrada uma taxa de ${formatCurrency(penalty)} (20%).`
        : 'O cancelamento é gratuito. Se você já pagou, o valor será estornado.',
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Cancelar pedido', style: 'destructive', onPress: () => cancelTask.mutate({ taskId: task.id }) },
      ]
    );
  };

  const hasActions = canChat || canPay || canAccept || canStart || canComplete || canCancel || canReview || canDispute;

  const fmtStep = (d?: Date | string | null) =>
    d
      ? new Date(d)
          .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          .replace(',', ' •')
      : null;
  const steps: TimelineStep[] = [
    { label: 'Solicitado', caption: fmtStep(task.createdAt) },
    { label: 'Confirmado', caption: fmtStep(task.acceptedAt) },
    { label: 'Em andamento', caption: fmtStep(task.startedAt) },
    { label: 'Concluído', caption: fmtStep(task.completedAt) },
  ];
  const currentStep = STEP_INDEX[task.status] ?? 0;
  const offTrack = task.status === 'CANCELLED' || task.status === 'DISPUTED';
  const orderCode = `#TR-${task.id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
  const other = isClient ? task.assignment?.tasker ?? null : task.client;
  const scheduled = task.scheduledAt ? new Date(task.scheduledAt) : null;
  const headerTitle = isClient ? 'Meu pedido' : task.status === 'OPEN' ? 'Solicitação de serviço' : 'Detalhes do serviço';

  type Primary = { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; loading: boolean };
  const primary: Primary | null = canPay
    ? { label: 'Pagar com Pix', icon: 'qr-code-outline', onPress: () => router.push(`/task/${task.id}/payment`), loading: false }
    : canAccept
      ? { label: 'Aceitar serviço', icon: 'checkmark-circle-outline', onPress: handleAccept, loading: acceptTask.isPending }
      : canStart
        ? { label: 'Iniciar trabalho', icon: 'play-outline', onPress: handleStart, loading: startTask.isPending }
        : canComplete
          ? { label: 'Concluir serviço', icon: 'checkmark-done-outline', onPress: handleComplete, loading: completeTask.isPending }
          : canReview
            ? {
                label: isClient ? 'Finalizar e avaliar' : 'Avaliar cliente',
                icon: 'star-outline',
                onPress: () => router.push(`/task/${task.id}/review`),
                loading: false,
              }
            : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={headerTitle}
        center
        paddingTop={insets.top}
        right={
          isClient && task.status === 'OPEN' ? (
            <IconButton icon="create-outline" label="Editar pedido" color={colors.orange} onPress={() => router.push(`/task/${task.id}/edit`)} />
          ) : null
        }
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 230 }}>
        {/* Order + timeline */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconCircle icon={categoryIcon(task.category)} size={52} bg={colors.skySoft} color={colors.navy} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Pedido {orderCode}</Text>
              <Text numberOfLines={2} style={{ fontSize: 14, color: colors.inkSoft }}>
                {task.title}
              </Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: 16 }} />
          {offTrack ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <StatusBadge status={task.status} />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, color: colors.inkMuted }}>
                {task.status === 'CANCELLED' ? 'Este pedido foi cancelado.' : 'Nossa equipe está analisando o caso.'}
              </Text>
            </View>
          ) : (
            <StatusTimeline steps={steps} current={currentStep} />
          )}
          {task.isUrgent && (
            <View style={{ marginTop: 12 }}>
              <Badge label="Urgente (+30%)" tone="warning" icon="flash" />
            </View>
          )}
        </Card>

        {/* Other party */}
        {other ? (
          <Card style={{ marginTop: 14 }} onPress={() => router.push(`/user/${other.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={other.name} uri={other.avatarUrl} size={56} verified={isClient} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 12.5, color: colors.inkMuted }}>{isClient ? 'Profissional' : 'Cliente'}</Text>
                <Text style={{ fontSize: 16.5, fontWeight: '800', color: colors.ink }}>{other.name ?? 'Usuário'}</Text>
                <Text style={{ fontSize: 13, color: colors.inkMuted }}>{task.category.name}</Text>
              </View>
              {canChat && (
                <IconButton icon="chatbubble-ellipses-outline" label="Abrir chat" filled onPress={() => router.push(`/task/${task.id}/chat`)} />
              )}
            </View>
          </Card>
        ) : isClient ? (
          <Card style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.skySoft }}>
            <Ionicons name="hourglass-outline" size={22} color={colors.sky} />
            <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, color: colors.ink }}>
              Aguardando um profissional da categoria aceitar o seu pedido.
            </Text>
          </Card>
        ) : null}

        {/* Schedule */}
        <Card style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 12 }}>Detalhes do agendamento</Text>
          <InfoRow icon="calendar-outline">
            {scheduled ? scheduled.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Assim que possível'}
          </InfoRow>
          {scheduled && <InfoRow icon="time-outline">{scheduled.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</InfoRow>}
          <InfoRow icon="location-outline">{task.address}</InfoRow>
          {task.description ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 6, marginBottom: 4 }}>Descrição</Text>
              <Text style={{ fontSize: 14.5, lineHeight: 20, color: colors.inkSoft }}>{task.description}</Text>
            </>
          ) : null}
        </Card>

        {/* Payment status */}
        {payment && PAYMENT_STATUS_CONFIG[payment.status] && (
          <Card style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
            <IconCircle icon={PAYMENT_STATUS_CONFIG[payment.status].icon} bg={colors.background} color={colors.navy} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{PAYMENT_STATUS_CONFIG[payment.status].label}</Text>
              <Text style={{ fontSize: 13, color: colors.inkMuted, marginTop: 2 }}>{PAYMENT_STATUS_CONFIG[payment.status].description}</Text>
            </View>
          </Card>
        )}

        {/* Values: the client sees what they pay, the tasker what they get */}
        <Card style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 12 }}>Valores</Text>
          <PriceLine label="Valor do serviço" value={formatCurrency(task.baseValue)} />
          {task.urgencyFee > 0 && <PriceLine label="Taxa de urgência" value={`+${formatCurrency(task.urgencyFee)}`} />}
          {isClient ? (
            <PriceLine label="Taxa de serviço (5%)" value={`+${formatCurrency(task.serviceFee)}`} muted />
          ) : (
            <PriceLine label="Comissão Trampo (15%)" value={`-${formatCurrency(task.baseValue + task.urgencyFee - task.taskerValue)}`} muted />
          )}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              paddingTop: 12,
              marginTop: 4,
            }}
          >
            <Text style={{ fontWeight: '800', color: colors.ink }}>{isClient ? 'Total' : 'Você recebe'}</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>
              {formatCurrency(isClient ? task.totalValue : task.taskerValue)}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {hasActions && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 14) + 6,
          }}
        >
          {primary && <Button label={primary.label} icon={primary.icon} onPress={primary.onPress} loading={primary.loading} />}
          {canChat && (
            <Button
              label={isClient ? 'Falar com o profissional' : 'Falar com o cliente'}
              variant="soft"
              icon="chatbubble-outline"
              size="md"
              onPress={() => router.push(`/task/${task.id}/chat`)}
              style={{ marginTop: primary ? 10 : 0 }}
            />
          )}
          {(canCancel || canDispute) && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 12 }}>
              {canCancel && (
                <Pressable onPress={handleCancel} disabled={cancelTask.isPending} hitSlop={8} accessibilityRole="button">
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>
                    {cancelTask.isPending ? 'Cancelando...' : isTasker ? 'Desistir do serviço' : 'Cancelar pedido'}
                  </Text>
                </Pressable>
              )}
              {canDispute && (
                <Pressable onPress={() => router.push(`/task/${task.id}/dispute`)} hitSlop={8} accessibilityRole="button">
                  <Text style={{ color: colors.inkMuted, fontWeight: '600' }}>Abrir suporte</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function PriceLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: colors.inkMuted }}>{label}</Text>
      <Text style={{ color: muted ? colors.inkMuted : colors.ink, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
