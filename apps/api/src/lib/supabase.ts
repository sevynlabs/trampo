import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase Admin Client
 *
 * Uses SERVICE_ROLE_KEY for server-side operations.
 * NEVER expose this client or key to the frontend!
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Broadcast a message to a Realtime channel
 *
 * Used for:
 * - Chat messages
 * - Task status updates
 * - Payment confirmations
 */
export async function broadcastToChannel(
  channel: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const channelRef = supabase.channel(channel);

  await channelRef.send({
    type: 'broadcast',
    event,
    payload,
  });

  // Unsubscribe after sending (we're just broadcasting, not listening)
  await supabase.removeChannel(channelRef);
}

/**
 * Broadcast a chat message to task participants
 */
export async function broadcastChatMessage(
  taskId: string,
  message: {
    id: string;
    senderId: string;
    senderName: string | null;
    senderAvatar: string | null;
    content: string;
    createdAt: string;
  }
): Promise<void> {
  const channel = `task:${taskId}:chat`;

  await broadcastToChannel(channel, 'new_message', {
    message,
  });

  console.log(`[REALTIME] Broadcast message to ${channel}`);
}

/**
 * Broadcast task status update
 */
export async function broadcastTaskUpdate(
  taskId: string,
  update: {
    status: string;
    updatedAt: string;
    updatedBy: string;
  }
): Promise<void> {
  const channel = `task:${taskId}`;

  await broadcastToChannel(channel, 'status_update', update);

  console.log(`[REALTIME] Broadcast status update to ${channel}`);
}
