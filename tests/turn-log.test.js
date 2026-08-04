import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, resolveCombat } from '../src/core.js';
import { createCard } from '../src/cards.js';
import { TurnLedger, describeEvent } from '../src/turn-log.js';

test('real combat events describe attackers, damage, remaining health, deaths, and bones', () => {
  const stoat = createCard('stoat');
  const bullfrog = createCard('bullfrog');
  const opossum = createCard('opossum');
  const result = resolveCombat(createBattle({ playerLanes: [stoat], opponentLanes: [bullfrog] }), 'player');

  assert.equal(describeEvent(result.events[0]), 'Bullfrog blocks Stoat in lane 1 and takes 1 damage. Bullfrog has 1 health left.');
  assert.equal(result.events[0].attackerName, 'Stoat');
  assert.equal(result.events[0].defenderName, 'Bullfrog');
  assert.equal(result.events[0].healthRemaining, 1);

  const lethal = resolveCombat(createBattle({ opponentLanes: [stoat], playerLanes: [{ ...opossum, health: 1 }] }), 'opponent');
  assert.equal(describeEvent(lethal.events[0]), 'Opossum blocks Stoat in lane 1 and takes 1 damage, killing it.');
  assert.equal(describeEvent(lethal.events[1]), 'Opossum dies in lane 1. You gain 1 Bone.');
});

test('direct attacks explain open lanes, airborne bypass, and the resulting balance', () => {
  const wolf = createCard('wolf');
  const open = resolveCombat(createBattle({ playerLanes: [null, null, wolf] }), 'player');
  assert.equal(describeEvent(open.events[0]), 'Wolf attacks through open lane 3 for 3 scale damage. You now lead by 3.');

  const raven = createCard('raven');
  const blocker = createCard('stoat');
  const airborne = resolveCombat(createBattle({ opponentLanes: [null, null, null, raven], playerLanes: [null, null, null, blocker] }), 'opponent');
  assert.equal(describeEvent(airborne.events[0]), 'Raven flies over Stoat in lane 4 for 2 scale damage. The opponent now leads by 2.');
});

test('event formatter explains non-combat actions without exposing internal keys', () => {
  assert.equal(describeEvent({ type: 'draw', cardName: 'Squirrel', source: 'side' }), 'You draw Squirrel from the Squirrel deck.');
  assert.equal(describeEvent({ type: 'sacrifice', cardNames: ['Squirrel'], blood: 1, bonesGained: 1 }), 'You offer Squirrel for 1 Blood and gain 1 Bone.');
  assert.equal(describeEvent({ type: 'play', cardName: 'Stoat', lane: 0 }), 'You play Stoat in lane 1.');
  assert.equal(describeEvent({ type: 'deploy', cardName: 'Bullfrog', lane: 1 }), 'The opponent sends Bullfrog into lane 2.');
  assert.equal(describeEvent({ type: 'blocked-deploy', cardName: 'Raven', lane: 3 }), 'Raven cannot enter occupied lane 4; deployment fails.');
  assert.equal(describeEvent({ type: 'mature', beforeName: 'Wolf Cub', afterName: 'Wolf', lane: 2, side: 'player' }), 'Your Wolf Cub matures into Wolf in lane 3.');
  assert.equal(describeEvent({ type: 'create-hand', sourceName: 'Warren', cardName: 'Rabbit' }), 'Warren opens a Rabbit Hole and adds Rabbit to your hand.');
  assert.equal(describeEvent({ type: 'fecundity', cardName: 'Field Mice' }), 'Field Mice creates one copy in your hand. The copy cannot replicate again.');
  assert.equal(describeEvent({ type: 'return-hand', cardName: 'Ouroboros', reason: 'sacrifice' }), 'Ouroboros is Unkillable and returns to your hand after the sacrifice.');
  assert.equal(describeEvent({ type: 'return-hand', cardName: 'Cockroach', reason: 'combat' }), 'Cockroach is Unkillable and returns to your hand after dying.');
  assert.equal(describeEvent({ type: 'stinky', sourceName: 'Skunk', attackerName: 'Wolf', powerBefore: 3, powerAfter: 2 }), 'Skunk’s Stinky lowers Wolf from 3 Power to 2 Power for this attack.');
  assert.equal(describeEvent({ type: 'bones', reason: 'Broken Bones', amount: 2, total: 3, pluralSource: true }), 'Broken Bones add 2 Bones. You have 3.');
});

test('turn ledger groups player and opponent phases and bounds old turns', () => {
  const ledger = new TurnLedger({ maxTurns: 2 });
  ledger.beginTurn(1);
  ledger.add({ type: 'draw', cardName: 'Squirrel', source: 'side' });
  ledger.beginPhase('opponent');
  ledger.add({ type: 'deploy', cardName: 'Bullfrog', lane: 1 });
  ledger.beginTurn(2);
  ledger.addText('No card was drawn because both piles are empty.', 'resource');
  ledger.beginTurn(3);
  ledger.addText('A new turn begins.', 'system');

  const turns = ledger.snapshot();
  assert.equal(turns.length, 2);
  assert.equal(turns[0].turn, 2);
  assert.equal(turns[1].turn, 3);
  assert.equal(turns[1].phases[0].side, 'player');
  assert.equal(turns[0].phases[0].entries[0].text, 'No card was drawn because both piles are empty.');
});
