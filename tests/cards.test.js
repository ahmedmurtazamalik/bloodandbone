import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_LIBRARY, createCard, STARTER_DECK } from '../src/cards.js';

test('curated library supports blood, bones, free tokens, and core sigil archetypes', () => {
  assert.ok(Object.keys(CARD_LIBRARY).length >= 24);
  assert.equal(CARD_LIBRARY.squirrel.cost.type, 'free');
  assert.equal(CARD_LIBRARY.wolf.cost.type, 'blood');
  assert.equal(CARD_LIBRARY.cockroach.cost.type, 'bones');
  const sigils = new Set(Object.values(CARD_LIBRARY).flatMap(card => card.sigils));
  for (const sigil of ['airborne', 'mighty-leap', 'touch-of-death', 'many-lives', 'worthy-sacrifice', 'bifurcated', 'unkillable', 'fledgling']) {
    assert.equal(sigils.has(sigil), true, `missing ${sigil}`);
  }
});

test('card instances receive unique ids without mutating templates', () => {
  const first = createCard('wolf');
  const second = createCard('wolf');
  assert.notEqual(first.id, second.id);
  first.health -= 1;
  assert.equal(second.health, CARD_LIBRARY.wolf.health);
});

test('baseline animal stats preserve canonical costs and meaningful roles', () => {
  assert.deepEqual(
    { cost: CARD_LIBRARY.wolf.cost, power: CARD_LIBRARY.wolf.power, health: CARD_LIBRARY.wolf.health },
    { cost: { type: 'blood', amount: 2 }, power: 3, health: 2 },
    'Wolf must never regress to its overpowered 1-Blood version',
  );
  assert.deepEqual(
    { power: CARD_LIBRARY.blackGoat.power, health: CARD_LIBRARY.blackGoat.health, sigils: CARD_LIBRARY.blackGoat.sigils },
    { power: 0, health: 1, sigils: ['worthy-sacrifice'] },
    'Black Goat is a resource creature, not a stronger combat animal',
  );
  assert.deepEqual(
    { power: CARD_LIBRARY.riverSnapper.power, health: CARD_LIBRARY.riverSnapper.health },
    { power: 1, health: 6 },
    'River Snapper trades offense for a durable defensive role',
  );
  assert.deepEqual(
    { stats: [CARD_LIBRARY.mantis.power, CARD_LIBRARY.mantis.health], sigils: CARD_LIBRARY.mantis.sigils },
    { stats: [1, 1], sigils: ['bifurcated'] },
  );
  assert.deepEqual(
    { stats: [CARD_LIBRARY.mantisGod.power, CARD_LIBRARY.mantisGod.health], sigils: CARD_LIBRARY.mantisGod.sigils },
    { stats: [1, 1], sigils: ['trifurcated'] },
    'Mantis God earns rare status by striking three lanes rather than two',
  );
});

test('starter deck is compact, playable, and contains both economies', () => {
  assert.ok(STARTER_DECK.length >= 8 && STARTER_DECK.length <= 12);
  const cards = STARTER_DECK.map(key => CARD_LIBRARY[key]);
  assert.ok(cards.some(card => card.cost.type === 'blood'));
  assert.ok(cards.some(card => card.cost.type === 'bones'));
  assert.ok(cards.filter(card => card.cost.type === 'blood' && card.cost.amount === 1).length >= 3);
});
