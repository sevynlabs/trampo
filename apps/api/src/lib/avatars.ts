import { supabase } from './supabase';

export const AVATAR_BUCKET = 'avatars';

let ensured = false;

/**
 * Profile photos live in a PUBLIC bucket (they are shown to everyone in the
 * app). Created on first use so a fresh Supabase project needs no manual step.
 * Only the API (service role) can write: the app uploads through a signed URL.
 */
export async function ensureAvatarBucket(): Promise<void> {
  if (ensured) return;
  const { data } = await supabase.storage.getBucket(AVATAR_BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(AVATAR_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  ensured = true;
}

export function avatarPublicUrl(path: string): string {
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Removes every previous photo of the user except `keep` (best effort). */
export async function removeOldAvatars(userId: string, keep?: string): Promise<void> {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
  const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (stale.length) await supabase.storage.from(AVATAR_BUCKET).remove(stale);
}
