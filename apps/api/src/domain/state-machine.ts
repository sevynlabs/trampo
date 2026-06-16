import type { TaskStatus } from '@trampo/contracts';

/**
 * Task State Machine
 *
 * Enforces valid state transitions for tasks.
 * Invalid transitions throw errors.
 *
 * States:
 * - OPEN: Task created, waiting for tasker
 * - ACCEPTED: Tasker accepted, payment confirmed
 * - IN_PROGRESS: Tasker started work
 * - COMPLETED: Tasker finished, escrow held
 * - RELEASED: Escrow released to tasker (1h after completion)
 * - CANCELLED: Task cancelled (with/without penalty)
 * - DISPUTED: Under review by admin
 */

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: ['RELEASED', 'DISPUTED'],
  RELEASED: [], // Terminal state
  CANCELLED: [], // Terminal state
  DISPUTED: ['RELEASED', 'CANCELLED'], // Admin resolves
};

/**
 * Check if a state transition is valid
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Assert that a state transition is valid
 * @throws Error if transition is invalid
 */
export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`);
  }
}

/**
 * Check if task can be cancelled
 */
export function canCancel(status: TaskStatus): boolean {
  return status === 'OPEN' || status === 'ACCEPTED';
}

/**
 * Check if task is in a terminal state
 */
export function isTerminal(status: TaskStatus): boolean {
  return status === 'RELEASED' || status === 'CANCELLED';
}

/**
 * Check if escrow can be released
 */
export function canRelease(status: TaskStatus): boolean {
  return status === 'COMPLETED';
}

/**
 * Get human-readable status label in Portuguese
 */
export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    OPEN: 'Aberto',
    ACCEPTED: 'Aceito',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluído',
    RELEASED: 'Liberado',
    CANCELLED: 'Cancelado',
    DISPUTED: 'Em disputa',
  };
  return labels[status];
}
