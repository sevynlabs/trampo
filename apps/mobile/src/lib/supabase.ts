import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase URL and anon key from app config
const rawUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const rawKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate URL is actually a valid HTTP(S) URL
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : null;
const supabaseAnonKey = rawKey && rawKey.length > 10 ? rawKey : null;
const isConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isConfigured && __DEV__) {
  console.warn('[SUPABASE] Missing or invalid URL/key. Realtime features disabled.');
}

/**
 * Supabase Client for mobile app
 *
 * Uses ANON_KEY (public) - safe for client-side.
 * Only used for Realtime subscriptions, not for auth or DB.
 */
export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

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
  onNewMessage: (messageId: string) => void
): () => void {
  if (!supabase) {
    if (__DEV__) console.warn('[REALTIME] Supabase not configured, skipping subscription');
    return () => {};
  }

  const channelName = `task:${taskId}:chat`;

  const channel = supabase
    .channel(channelName)
    // The broadcast is only a content-free ping (the public channel can be
    // spoofed); message content is always fetched through the authorized API.
    .on('broadcast', { event: 'new_message' }, (payload) => {
      const id = payload.payload?.message?.id;
      if (typeof id === 'string') {
        onNewMessage(id);
      }
    })
    .subscribe((status) => {
      if (__DEV__) console.log(`[REALTIME] ${channelName}: ${status}`);
    });

  // Return cleanup function
  return () => {
    if (__DEV__) console.log(`[REALTIME] Unsubscribing from ${channelName}`);
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
  if (!supabase) {
    if (__DEV__) console.warn('[REALTIME] Supabase not configured, skipping subscription');
    return () => {};
  }

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
