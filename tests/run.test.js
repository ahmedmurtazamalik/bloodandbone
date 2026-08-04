import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, completeBattle, chooseReward, startingBonesForEncounter } from '../src/run.js';

test('Marrow Reserve scales from one to three starting Bones across the trials', () => {
  assert.equal(startingBonesForEncounter(0), 1);
  assert.equal(startingBonesForEncounter(1), 2);
  assert.equal(startingBonesForEncounter(2), 3);
  assert.equal(startingBonesForEncounter(99), 3);
});

test('reward offers vary by run seed and do not repeat rejected cards in the next offer', () => {
  const firstReward = completeBattle(createRun({ rewardSeed: 11 }), true);
  const differentRun = completeBattle(createRun({ rewardSeed: 29 }), true);

  assert.equal(firstReward.rewardOptions.length, 3);
  assert.equal(new Set(firstReward.rewardOptions).size, 3);
  assert.notDeepEqual(firstReward.rewardOptions, differentRun.rewardOptions);

  const afterChoice = chooseReward(firstReward, firstReward.rewardOptions[0]);
  const secondReward = completeBattle(afterChoice, true);
  assert.equal(secondReward.rewardOptions.length, 3);
  assert.equal(secondReward.rewardOptions.some(key => firstReward.rewardOptions.includes(key)), false);
});

test('only a card in the current reward offer can be chosen', () => {
  const reward = completeBattle(createRun({ rewardSeed: 7 }), true);
  assert.deepEqual(chooseReward(reward, 'squirrel'), reward);
});

test('three victories with two card rewards complete a compact run', () => {
  let run = createRun();
  assert.equal(run.encounter, 0);
  assert.equal(run.phase, 'battle');
  const originalSize = run.deck.length;

  run = completeBattle(run, true);
  assert.equal(run.phase, 'reward');
  run = chooseReward(run, run.rewardOptions[0]);
  assert.equal(run.encounter, 1);
  assert.equal(run.phase, 'battle');
  assert.equal(run.deck.length, originalSize + 1);

  run = completeBattle(run, true);
  run = chooseReward(run, run.rewardOptions[0]);
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
