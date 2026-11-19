import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertTransition, canCancel, isTerminal, canRelease } from './state-machine';

// open → accepted → in_progress → completed → released (+ cancelled / disputed)

test('caminho feliz do pedido', () => {
  assert.ok(canTransition('OPEN', 'ACCEPTED'));
  assert.ok(canTransition('ACCEPTED', 'IN_PROGRESS'));
  assert.ok(canTransition('IN_PROGRESS', 'COMPLETED'));
  assert.ok(canTransition('COMPLETED', 'RELEASED'));
});

test('não pula etapas nem volta', () => {
  assert.equal(canTransition('OPEN', 'COMPLETED'), false);
  assert.equal(canTransition('OPEN', 'RELEASED'), false);
  assert.equal(canTransition('COMPLETED', 'IN_PROGRESS'), false);
  assert.throws(() => assertTransition('ACCEPTED', 'RELEASED'), /Transição inválida/);
});

test('disputa só depois de começar, e o admin resolve', () => {
  assert.equal(canTransition('ACCEPTED', 'DISPUTED'), false);
  assert.ok(canTransition('IN_PROGRESS', 'DISPUTED'));
  assert.ok(canTransition('COMPLETED', 'DISPUTED'));
  assert.ok(canTransition('DISPUTED', 'RELEASED'));
  assert.ok(canTransition('DISPUTED', 'CANCELLED'));
});

test('finalizado e cancelado são estados finais', () => {
  assert.ok(isTerminal('RELEASED'));
  assert.ok(isTerminal('CANCELLED'));
  assert.equal(canTransition('RELEASED', 'DISPUTED'), false);
  assert.equal(canTransition('CANCELLED', 'OPEN'), false);
});

test('cancelar só antes de começar; liberar só depois de concluir', () => {
  assert.ok(canCancel('OPEN'));
  assert.ok(canCancel('ACCEPTED'));
  assert.equal(canCancel('IN_PROGRESS'), false);
  assert.ok(canRelease('COMPLETED'));
  assert.equal(canRelease('IN_PROGRESS'), false);
});
