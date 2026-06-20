import { prisma } from '@trampo/db';

/**
 * Expo Push Notification Service
 *
 * Uses Expo's push notification service to send notifications to both iOS and Android.
 * Push tokens are in the format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

/**
 * Send push notification to a single user
 */
export async function sendPushNotification(
  userId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });

  if (!user?.pushToken) {
    console.log(`[PUSH] No push token for user ${userId}`);
    return false;
  }

  return sendToToken(user.pushToken, notification);
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationBulk(
  userIds: string[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, pushToken: true },
  });

  const tokens = users.filter((u) => u.pushToken).map((u) => u.pushToken!);

  if (tokens.length === 0) {
    console.log(`[PUSH] No push tokens found for ${userIds.length} users`);
    return 0;
  }

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    sound: 'default',
    priority: 'high',
  }));

  const results = await sendBatch(messages);
  return results.filter((r) => r.status === 'ok').length;
}

/**
 * Send notification to a specific push token
 */
async function sendToToken(
  token: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  const message: ExpoPushMessage = {
    to: token,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    sound: 'default',
    priority: 'high',
  };

  const [result] = await sendBatch([message]);
  return result?.status === 'ok';
}

/**
 * Send batch of messages to Expo Push API
 */
async function sendBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(`[PUSH] Expo API error: ${response.status}`);
      return messages.map(() => ({ status: 'error' as const }));
    }

    const result = (await response.json()) as { data: ExpoPushTicket[] };
    const tickets = result.data;

    // Handle errors and potentially remove invalid tokens
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error') {
        console.error(`[PUSH] Error sending to ${messages[i].to}:`, ticket.message);

        // Remove invalid tokens from database
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await prisma.user.updateMany({
            where: { pushToken: messages[i].to },
            data: { pushToken: null },
          });
          console.log(`[PUSH] Removed invalid token: ${messages[i].to}`);
        }
      }
    }

    console.log(`[PUSH] Sent ${tickets.filter((t) => t.status === 'ok').length}/${messages.length} notifications`);
    return tickets;
  } catch (error) {
    console.error('[PUSH] Failed to send notifications:', error);
    return messages.map(() => ({ status: 'error' as const }));
  }
}

// ============================================
// Notification Templates
// ============================================

export const notifications = {
  /**
   * Task accepted by tasker - notify client
   */
  taskAccepted: (taskTitle: string, taskerName: string) => ({
    title: 'Trampo Aceito! 🎉',
    body: `${taskerName} aceitou seu trampo "${taskTitle}". Faça o pagamento para ele começar.`,
    data: { type: 'task_accepted' },
  }),

  /**
   * Payment confirmed - notify tasker
   */
  paymentConfirmed: (taskTitle: string) => ({
    title: 'Pagamento Confirmado! 💰',
    body: `O pagamento do trampo "${taskTitle}" foi confirmado. Você já pode começar!`,
    data: { type: 'payment_confirmed' },
  }),

  /**
   * Task completed - notify client
   */
  taskCompleted: (taskTitle: string, taskerName: string) => ({
    title: 'Trampo Concluído! ✅',
    body: `${taskerName} concluiu o trampo "${taskTitle}". Não esqueça de avaliar!`,
    data: { type: 'task_completed' },
  }),

  /**
   * Payment released - notify tasker
   */
  paymentReleased: (amount: number, taskTitle: string) => ({
    title: 'Pagamento Liberado! 🎊',
    body: `R$ ${(amount / 100).toFixed(2)} do trampo "${taskTitle}" foi liberado para você.`,
    data: { type: 'payment_released' },
  }),

  /**
   * New chat message
   */
  newMessage: (senderName: string, taskTitle: string) => ({
    title: `Nova mensagem de ${senderName}`,
    body: `Sobre: ${taskTitle}`,
    data: { type: 'new_message' },
  }),

  /**
   * Task cancelled
   */
  taskCancelled: (taskTitle: string, reason?: string) => ({
    title: 'Trampo Cancelado',
    body: reason
      ? `O trampo "${taskTitle}" foi cancelado: ${reason}`
      : `O trampo "${taskTitle}" foi cancelado.`,
    data: { type: 'task_cancelled' },
  }),

  /**
   * New review received
   */
  newReview: (rating: number, reviewerName: string) => ({
    title: `Nova avaliação: ${'⭐'.repeat(rating)}`,
    body: `${reviewerName} deixou uma avaliação para você.`,
    data: { type: 'new_review' },
  }),

  /**
   * Dispute opened - notify the other party
   */
  disputeOpened: (taskTitle: string) => ({
    title: 'Disputa Aberta ⚠️',
    body: `Uma disputa foi aberta no trampo "${taskTitle}". Nossa equipe vai analisar.`,
    data: { type: 'dispute_opened' },
  }),

  /**
   * Dispute resolved - notify both parties
   */
  disputeResolved: (taskTitle: string, outcome: 'released' | 'refunded') => ({
    title: 'Disputa Resolvida ✅',
    body:
      outcome === 'released'
        ? `A disputa do trampo "${taskTitle}" foi resolvida e o pagamento foi liberado ao profissional.`
        : `A disputa do trampo "${taskTitle}" foi resolvida e o valor foi reembolsado ao cliente.`,
    data: { type: 'dispute_resolved' },
  }),
};
