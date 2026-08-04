import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTER_SCRIPTS, previewForTurn, deployPreview } from '../src/encounters.js';
import { createBattle } from '../src/core.js';

test('every encounter script uses legal cards and lanes while allowing breathing turns', () => {
  for (let encounter = 0; encounter < ENCOUNTER_SCRIPTS.length; encounter += 1) {
    assert.equal(ENCOUNTER_SCRIPTS[encounter].length, 16, `encounter ${encounter + 1} needs a complete sixteen-turn arc`);
    let totalThreats = 0;
    let defensiveCreatures = 0;
    for (let turn = 1; turn <= ENCOUNTER_SCRIPTS[encounter].length; turn += 1) {
      const preview = previewForTurn(encounter, turn);
      totalThreats += preview.length;
      defensiveCreatures += preview.filter(entry => entry.card.power <= 1 && entry.card.health >= 3).length;
      assert.ok(preview.every(entry => entry.lane >= 0 && entry.lane < 4));
      assert.ok(preview.every(entry => entry.card.name && Number.isFinite(entry.card.power)));
    }
    assert.ok(totalThreats >= 10);
    assert.ok(defensiveCreatures >= 3, `encounter ${encounter + 1} needs three durable blockers`);
    assert.ok(ENCOUNTER_SCRIPTS[encounter].filter(row => row.length === 0).length >= 3, `encounter ${encounter + 1} needs three breathing turns`);
  }
});

test('telegraphed cards descend into open enemy lanes without replacing survivors', () => {
  const battle = createBattle({ opponentLanes: [{ id: 'blocker', name: 'Survivor', power: 1, health: 2 }] });
  const result = deployPreview(battle, [
    { lane: 0, card: { id: 'wolf-a', key: 'wolf', name: 'Wolf', power: 3, health: 2 } },
    { lane: 2, card: { id: 'stoat-a', key: 'stoat', name: 'Stoat', power: 1, health: 3 } },
  ]);
  assert.equal(result.state.opponentLanes[0].name, 'Survivor');
  assert.equal(result.state.opponentLanes[2].name, 'Stoat');
  assert.deepEqual(result.blocked, [0]);
});
