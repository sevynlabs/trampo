import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, calculateCancellationPenalty, DEFAULT_RATES } from './pricing';

// Business rules (CLAUDE.md): client fee 5%, tasker commission 15%,
// urgency +30%, cancellation penalty 20% within 30 min, money in centavos.

test('preço normal: R$ 100 → cliente paga R$ 105, profissional recebe R$ 85', () => {
  const q = calculatePrice(10_000, false);
  assert.equal(q.urgencyFee, 0);
  assert.equal(q.adjustedBase, 10_000);
  assert.equal(q.serviceFee, 500);
  assert.equal(q.totalValue, 10_500);
  assert.equal(q.commission, 1_500);
  assert.equal(q.taskerValue, 8_500);
});

test('urgente: +30% sobre a base antes das taxas', () => {
  const q = calculatePrice(10_000, true);
  assert.equal(q.urgencyFee, 3_000);
  assert.equal(q.adjustedBase, 13_000);
  assert.equal(q.serviceFee, 650);
  assert.equal(q.totalValue, 13_650);
  assert.equal(q.taskerValue, 11_050);
});

test('valores sempre inteiros (centavos), mesmo com base quebrada', () => {
  const q = calculatePrice(5_333, true);
  for (const v of Object.values(q)) assert.ok(Number.isInteger(v), `${v} não é inteiro`);
  // o que o cliente paga cobre exatamente repasse + comissão + taxa
  assert.equal(q.totalValue, q.taskerValue + q.commission + q.serviceFee);
});

test('abaixo do mínimo é recusado', () => {
  assert.throws(() => calculatePrice(DEFAULT_RATES.minValue - 1, false), /Valor mínimo/);
  assert.doesNotThrow(() => calculatePrice(DEFAULT_RATES.minValue, false));
});

test('taxas vindas do painel são respeitadas', () => {
  const q = calculatePrice(20_000, false, { clientFee: 0.1, taskerFee: 0.2, urgencyFee: 0.5, minValue: 1_000 });
  assert.equal(q.serviceFee, 2_000);
  assert.equal(q.totalValue, 22_000);
  assert.equal(q.taskerValue, 16_000);
});

test('cancelamento sem horário marcado é grátis', () => {
  assert.equal(calculateCancellationPenalty(10_000, null, new Date()), 0);
});

test('cancelamento com 30 min ou mais de antecedência é grátis', () => {
  const now = new Date('2026-11-19T10:00:00Z');
  assert.equal(calculateCancellationPenalty(10_000, new Date('2026-11-19T10:30:00Z'), now), 0);
  assert.equal(calculateCancellationPenalty(10_000, new Date('2026-11-19T12:00:00Z'), now), 0);
});

test('cancelamento a menos de 30 min cobra 20%', () => {
  const now = new Date('2026-11-19T10:00:00Z');
  assert.equal(calculateCancellationPenalty(10_500, new Date('2026-11-19T10:29:00Z'), now), 2_100);
  assert.equal(calculateCancellationPenalty(10_500, new Date('2026-11-19T09:50:00Z'), now), 2_100);
});
