import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateEncounter } from '../scripts/simulate.mjs';

test('the first opponent keeps a competent player within five scale points through turn seven', () => {
  const result = simulateEncounter(0);
  const turnSeven = result.history.find(entry => entry.turn === 7);

  assert.ok(turnSeven, 'simulation must resolve seven complete rounds');
  assert.ok(turnSeven.scale <= 5, `player led by ${turnSeven.scale} after turn seven`);
});

test('the second opponent contests the scale by turn seven', () => {
  const result = simulateEncounter(1);
  const turnSeven = result.history.find(entry => entry.turn === 7);

  assert.ok(turnSeven.scale <= 5, `player led by ${turnSeven.scale} after turn seven`);
});

test('the final opponent applies its pressure before the late game', () => {
  const result = simulateEncounter(2);
  const turnSeven = result.history.find(entry => entry.turn === 7);

  assert.ok(turnSeven.scale <= 5, `player led by ${turnSeven.scale} after turn seven`);
});
