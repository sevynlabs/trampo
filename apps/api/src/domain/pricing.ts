import { TASK_CONSTANTS } from '@trampo/contracts';

/**
 * Pricing Engine
 *
 * Pure domain logic for calculating task prices.
 * All values in centavos (integers).
 *
 * NEVER trust values from the client - always recalculate server-side.
 */

export interface PriceQuote {
  baseValue: number; // Original value from client
  urgencyFee: number; // +30% if urgent
  adjustedBase: number; // baseValue + urgencyFee
  serviceFee: number; // 5% for client
  totalValue: number; // What client pays
  commission: number; // 15% platform fee
  taskerValue: number; // What tasker receives
}

/**
 * Calculate full price breakdown
 *
 * @param baseValue - Base task value in centavos (min R$ 50.00 = 5000)
 * @param isUrgent - True if task is <1h (adds 30%)
 * @returns Complete price breakdown
 * @throws If baseValue is below minimum
 */
export function calculatePrice(baseValue: number, isUrgent: boolean): PriceQuote {
  // Validate minimum
  if (baseValue < TASK_CONSTANTS.MIN_VALUE) {
    throw new Error(
      `Valor mínimo é R$ ${(TASK_CONSTANTS.MIN_VALUE / 100).toFixed(2)}`
    );
  }

  // Calculate urgency fee
  const urgencyFee = isUrgent
    ? Math.round(baseValue * TASK_CONSTANTS.URGENCY_FEE)
    : 0;

  // Adjusted base (with urgency)
  const adjustedBase = baseValue + urgencyFee;

  // Client service fee (5%)
  const serviceFee = Math.round(adjustedBase * TASK_CONSTANTS.CLIENT_FEE);

  // Total client pays
  const totalValue = adjustedBase + serviceFee;

  // Platform commission (15% of adjusted base)
  const commission = Math.round(adjustedBase * TASK_CONSTANTS.TASKER_FEE);

  // Tasker receives
  const taskerValue = adjustedBase - commission;

  return {
    baseValue,
    urgencyFee,
    adjustedBase,
    serviceFee,
    totalValue,
    commission,
    taskerValue,
  };
}

/**
 * Calculate cancellation penalty
 *
 * @param taskValue - Total task value in centavos
 * @param scheduledAt - When task was scheduled for
 * @param cancelledAt - When cancellation is requested
 * @returns Penalty amount in centavos (0 if free cancellation)
 */
export function calculateCancellationPenalty(
  taskValue: number,
  scheduledAt: Date | null,
  cancelledAt: Date
): number {
  // If no scheduled time, no penalty
  if (!scheduledAt) {
    return 0;
  }

  const minutesUntilTask =
    (scheduledAt.getTime() - cancelledAt.getTime()) / (1000 * 60);

  // Free cancellation up to 30 minutes before
  if (minutesUntilTask >= TASK_CONSTANTS.FREE_CANCEL_MINUTES) {
    return 0;
  }

  // 20% penalty
  return Math.round(taskValue * TASK_CONSTANTS.CANCEL_PENALTY);
}

/**
 * Format value from centavos to BRL string
 */
export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
