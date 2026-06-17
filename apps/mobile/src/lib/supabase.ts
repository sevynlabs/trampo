import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase URL and anon key from app config
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[SUPABASE] Missing URL or anon key. Realtime features will not work.');
}

/**
 * Supabase Client for mobile app
 *
 * Uses ANON_KEY (public) - safe for client-side.
 * Only used for Realtime subscriptions, not for auth or DB.
 */
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Chat message from Realtime
 */
export interface RealtimeChatMessage {
  id: string;
  senderId: string;
  senderName: string | null;
  senderAvatar: string | null;
  content: string;
  createdAt: string;
}

/**
 * Subscribe to chat messages for a task
 *
 * @param taskId - The task ID
 * @param onMessage - Callback when a new message arrives
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToChatMessages(
  taskId: string,
  onMessage: (message: RealtimeChatMessage) => void
): () => void {
  const channelName = `task:${taskId}:chat`;

  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'new_message' }, (payload) => {
      const message = payload.payload?.message as RealtimeChatMessage;
      if (message) {
        onMessage(message);
      }
    })
    .subscribe((status) => {
      console.log(`[REALTIME] ${channelName}: ${status}`);
    });

  // Return cleanup function
  return () => {
    console.log(`[REALTIME] Unsubscribing from ${channelName}`);
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to task status updates
 */
export function subscribeToTaskUpdates(
  taskId: string,
  onUpdate: (update: { status: string; updatedAt: string }) => void
): () => void {
  const channelName = `task:${taskId}`;

  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'status_update' }, (payload) => {
      onUpdate(payload.payload as { status: string; updatedAt: string });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
