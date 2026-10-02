/**
 * Where a notification should take the user. Shared by push taps and the
 * in-app notification list.
 */
export function getNotificationRoute(
  data: Record<string, unknown> | null | undefined
): string | null {
  const type = data?.type as string | undefined;
  const taskId = typeof data?.taskId === 'string' ? data.taskId : null;

  if (type === 'payment_released') return '/(tabs)/earnings';
  if (!taskId) return null;
  if (type === 'new_message') return `/task/${taskId}/chat`;
  return `/task/${taskId}`;
}
