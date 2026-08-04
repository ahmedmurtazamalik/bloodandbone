import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_PACING, pacingForEvent } from '../src/combat-pacing.js';

test('combat pacing gives players time to read each phase and outcome', () => {
  assert.ok(COMBAT_PACING.phaseLead >= 350);
  assert.ok(COMBAT_PACING.deployment >= 600);
  assert.ok(COMBAT_PACING.scoreSettle >= 600);
  assert.ok(pacingForEvent({ type: 'strike' }).windup >= 250);
  assert.ok(pacingForEvent({ type: 'strike' }).hold >= 450);
  assert.ok(pacingForEvent({ type: 'death' }).hold > pacingForEvent({ type: 'strike' }).hold);
  assert.ok(pacingForEvent({ type: 'direct' }).hold >= 600);
});

test('reduced motion preserves event order with short nonzero reading pauses', () => {
  const normal = pacingForEvent({ type: 'direct' });
  const reduced = pacingForEvent({ type: 'direct' }, true);
  assert.ok(reduced.windup > 0);
  assert.ok(reduced.hold > 0);
  assert.ok(reduced.windup < normal.windup);
  assert.ok(reduced.hold < normal.hold);
});
