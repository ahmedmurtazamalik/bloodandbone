import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, completeBattle, chooseReward } from '../src/run.js';

test('three victories with two card rewards complete a compact run', () => {
  let run = createRun();
  assert.equal(run.encounter, 0);
  assert.equal(run.phase, 'battle');
  const originalSize = run.deck.length;

  run = completeBattle(run, true);
  assert.equal(run.phase, 'reward');
  run = chooseReward(run, 'mantis');
  assert.equal(run.encounter, 1);
  assert.equal(run.phase, 'battle');
  assert.equal(run.deck.length, originalSize + 1);

  run = chooseReward(completeBattle(run, true), 'adder');
  assert.equal(run.encounter, 2);
  run = completeBattle(run, true);
  assert.equal(run.phase, 'victory');
});

test('a loss ends the run without changing its deck', () => {
  const run = createRun();
  const lost = completeBattle(run, false);
  assert.equal(lost.phase, 'defeat');
  assert.deepEqual(lost.deck, run.deck);
});
