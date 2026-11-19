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

/** Fee rates (fractions) and minimum used by the pricing engine. */
export interface PricingRates {
  clientFee: number; // 0.05 = 5%
  taskerFee: number; // 0.15 = 15%
  urgencyFee: number; // 0.30 = +30%
  minValue: number; // centavos
}

/** Defaults from @trampo/contracts; the live values come from the admin settings. */
export const DEFAULT_RATES: PricingRates = {
  clientFee: TASK_CONSTANTS.CLIENT_FEE,
  taskerFee: TASK_CONSTANTS.TASKER_FEE,
  urgencyFee: TASK_CONSTANTS.URGENCY_FEE,
  minValue: TASK_CONSTANTS.MIN_VALUE,
};

/**
 * Calculate full price breakdown
 *
 * @param baseValue - Base task value in centavos
 * @param isUrgent - True if task is <1h (adds the urgency fee)
 * @param rates - Fee rates; pass the platform settings (lib/platform-settings)
 * @returns Complete price breakdown
 * @throws If baseValue is below the minimum
 */
export function calculatePrice(baseValue: number, isUrgent: boolean, rates: PricingRates = DEFAULT_RATES): PriceQuote {
  // Validate minimum
  if (baseValue < rates.minValue) {
    throw new Error(`Valor mínimo é R$ ${(rates.minValue / 100).toFixed(2).replace('.', ',')}`);
  }

  // Calculate urgency fee
  const urgencyFee = isUrgent ? Math.round(baseValue * rates.urgencyFee) : 0;

  // Adjusted base (with urgency)
  const adjustedBase = baseValue + urgencyFee;

  // Client service fee (5%)
  const serviceFee = Math.round(adjustedBase * rates.clientFee);

  // Total client pays
  const totalValue = adjustedBase + serviceFee;

  // Platform commission (15% of adjusted base)
  const commission = Math.round(adjustedBase * rates.taskerFee);

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
