import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/core.js';
import { createCard } from '../src/cards.js';
import { advanceRound } from '../src/round-coordinator.js';

test('round adjudication waits for the opponent reply before declaring domination', () => {
  const battle = createBattle({
    turn: 12,
    scale: 19,
    hasDrawn: true,
    playerLanes: [createCard('stoat'), null, null, null],
    opponentLanes: [null, createCard('coyote'), null, null],
  });

  const round = advanceRound(battle, []);

  assert.equal(round.settledState.scale, 18);
  assert.equal(round.outcome, null);
  assert.equal(round.nextState.turn, 13);
  assert.deepEqual(round.phases.map(phase => phase.type), [
    'player-combat',
    'opponent-maturation',
    'opponent-deployment',
    'opponent-combat',
    'player-maturation',
    'turn-start',
  ]);
});

test('the canonical transcript attributes combat, maturation, and deployment events to phases', () => {
  const battle = createBattle({
    turn: 1,
    hasDrawn: true,
    playerLanes: [null, null, null, createCard('wolfCub')],
    opponentLanes: [createCard('wolfCub'), null, null, null],
  });
  const preview = [{ lane: 2, card: createCard('bullfrog') }];

  const round = advanceRound(battle, preview);
  const eventTypes = round.transcript.map(event => `${event.phase}:${event.type}`);

  assert.deepEqual(eventTypes, [
    'player-combat:combat-start',
    'player-combat:direct',
    'opponent-maturation:mature',
    'opponent-deployment:deploy',
    'opponent-combat:combat-start',
    'opponent-combat:direct',
    'opponent-combat:direct',
    'player-maturation:mature',
  ]);
  assert.equal(round.transcript.find(event => event.phase === 'opponent-maturation').afterName, 'Wolf');
  assert.equal(round.transcript.find(event => event.phase === 'player-maturation').afterName, 'Wolf');
});
