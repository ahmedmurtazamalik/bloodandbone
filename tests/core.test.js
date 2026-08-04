import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, playCard, resolveCombat, drawCard, ageCards, beginPlayerTurn } from '../src/core.js';
import { createCard } from '../src/cards.js';

test('blood-cost creatures require and consume eligible sacrifices', () => {
  const battle = createBattle({
    hand: [{ id: 'wolf', name: 'Wolf', cost: { type: 'blood', amount: 2 }, power: 3, health: 2 }],
    playerLanes: [
      { id: 'squirrel-a', name: 'Squirrel', cost: null, power: 0, health: 1 },
      { id: 'squirrel-b', name: 'Squirrel', cost: null, power: 0, health: 1 },
      null,
      null,
    ],
  });

  const result = playCard(battle, 'wolf', 2, [0, 1]);

  assert.equal(result.ok, true);
  assert.equal(result.state.playerLanes[0], null);
  assert.equal(result.state.playerLanes[1], null);
  assert.equal(result.state.playerLanes[2].name, 'Wolf');
  assert.equal(result.state.hand.length, 0);
  assert.equal(result.state.bones, 2);
});

test('bone-cost creatures spend bones without sacrifices', () => {
  const battle = createBattle({
    hand: [{ id: 'adder', name: 'Adder', cost: { type: 'bones', amount: 2 }, power: 1, health: 1 }],
    bones: 2,
  });
  const result = playCard(battle, 'adder', 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.bones, 0);
  assert.equal(result.state.playerLanes[1].name, 'Adder');
});

test('Rabbit Hole adds one free Rabbit to hand when Warren is played', () => {
  const warren = createCard('warren');
  const squirrel = createCard('squirrel');
  const result = playCard(createBattle({ hand: [warren], playerLanes: [null, squirrel] }), warren.id, 0, [1]);

  assert.equal(result.ok, true);
  assert.equal(result.state.playerLanes[0].name, 'Warren');
  assert.equal(result.state.hand.length, 1);
  assert.deepEqual(
    { key: result.state.hand[0].key, cost: result.state.hand[0].cost, power: result.state.hand[0].power, health: result.state.hand[0].health },
    { key: 'rabbit', cost: { type: 'free', amount: 0 }, power: 0, health: 1 },
  );
  assert.deepEqual(result.events, [{ type: 'create-hand', sourceName: 'Warren', cardName: 'Rabbit' }]);
});

test('Fecundity creates one non-replicating copy of Field Mice in hand', () => {
  const fieldMice = createCard('fieldMice');
  const squirrels = [createCard('squirrel'), createCard('squirrel')];
  const result = playCard(createBattle({ hand: [fieldMice], playerLanes: [squirrels[0], squirrels[1]] }), fieldMice.id, 2, [0, 1]);

  assert.equal(result.ok, true);
  assert.equal(result.state.hand.length, 1);
  const copy = result.state.hand[0];
  assert.deepEqual(
    { key: copy.key, cost: copy.cost, power: copy.power, health: copy.health },
    { key: 'fieldMice', cost: { type: 'blood', amount: 2 }, power: 2, health: 2 },
  );
  assert.equal(copy.sigils.includes('fecundity'), false);
  assert.deepEqual(result.events, [{ type: 'fecundity', cardName: 'Field Mice' }]);
});

test('Unkillable returns a sacrificed creature to the player hand and still grants a Bone', () => {
  const stoat = createCard('stoat');
  const ouroboros = createCard('ouroboros');
  const result = playCard(createBattle({ hand: [stoat], playerLanes: [ouroboros] }), stoat.id, 0, [0]);

  assert.equal(result.ok, true);
  assert.equal(result.state.playerLanes[0].name, 'Stoat');
  assert.equal(result.state.hand.length, 1);
  assert.equal(result.state.hand[0].name, 'Ouroboros');
  assert.equal(result.state.bones, 1);
  assert.ok(result.events.some(event => event.type === 'return-hand' && event.cardName === 'Ouroboros'));
});

test('Unkillable returns a player creature killed in combat to hand', () => {
  const wolf = createCard('wolf');
  const cockroach = createCard('cockroach');
  const result = resolveCombat(createBattle({ opponentLanes: [wolf], playerLanes: [cockroach] }), 'opponent');

  assert.equal(result.state.playerLanes[0], null);
  assert.equal(result.state.hand.length, 1);
  assert.equal(result.state.hand[0].name, 'Cockroach');
  assert.equal(result.state.bones, 1);
  assert.deepEqual(result.events.map(event => event.type), ['strike', 'death', 'return-hand']);
});

test('failed resource payments do not mutate the battle', () => {
  const battle = createBattle({
    hand: [{ id: 'vulture', name: 'Turkey Vulture', cost: { type: 'bones', amount: 8 }, power: 3, health: 3 }],
    bones: 3,
  });
  const result = playCard(battle, 'vulture', 0);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NOT_ENOUGH_BONES');
  assert.equal(result.state, battle);
});

test('combat resolves lanes left-to-right and open lanes tip the scale', () => {
  const battle = createBattle({
    playerLanes: [
      { id: 'wolf', name: 'Wolf', power: 3, health: 2 },
      { id: 'elk', name: 'Elk', power: 2, health: 4 },
      null,
      null,
    ],
    opponentLanes: [
      { id: 'stoat', name: 'Stoat', power: 1, health: 3 },
      null,
      null,
      null,
    ],
  });
  const result = resolveCombat(battle, 'player');
  assert.equal(result.state.opponentLanes[0], null);
  assert.equal(result.state.playerLanes[0].health, 2);
  assert.equal(result.state.scale, 2);
  assert.deepEqual(result.events.map(event => event.type), ['strike', 'death', 'direct']);
});

test('outer-lane creatures retain repeated damage and die at zero health', () => {
  for (const lane of [0, 3]) {
    let battle = createBattle({
      playerLanes: Array.from({ length: 4 }, (_, index) => index === lane
        ? { id: `attacker-${lane}`, name: 'Attacker', power: 1, health: 3 }
        : null),
      opponentLanes: Array.from({ length: 4 }, (_, index) => index === lane
        ? { id: `defender-${lane}`, name: 'Defender', power: 0, health: 3 }
        : null),
    });

    battle = resolveCombat(battle, 'player').state;
    assert.equal(battle.opponentLanes[lane].health, 2);
    battle = resolveCombat(battle, 'player').state;
    assert.equal(battle.opponentLanes[lane].health, 1);
    const lethal = resolveCombat(battle, 'player');
    assert.equal(lethal.state.opponentLanes[lane], null);
    assert.deepEqual(lethal.events.map(event => event.type), ['strike', 'death']);
  }
});

test('bifurcated strikes can kill creatures in either outer lane', () => {
  for (const [attackerLane, defenderLane] of [[1, 0], [2, 3]]) {
    let battle = createBattle({
      playerLanes: Array.from({ length: 4 }, (_, index) => index === attackerLane
        ? { id: `mantis-${attackerLane}`, name: 'Mantis', power: 1, health: 1, sigils: ['bifurcated'] }
        : null),
      opponentLanes: Array.from({ length: 4 }, (_, index) => index === defenderLane
        ? { id: `defender-${defenderLane}`, name: 'Defender', power: 0, health: 2 }
        : null),
    });

    battle = resolveCombat(battle, 'player').state;
    assert.equal(battle.opponentLanes[defenderLane].health, 1);
    battle = resolveCombat(battle, 'player').state;
    assert.equal(battle.opponentLanes[defenderLane], null);
  }
});

test('worthy sacrifice provides three blood and many lives survives payment', () => {
  const battle = createBattle({
    hand: [{ id: 'urayuli', name: 'Urayuli', cost: { type: 'blood', amount: 4 }, power: 7, health: 7 }],
    playerLanes: [
      { id: 'cat', name: 'Cat', power: 0, health: 1, sigils: ['many-lives'] },
      { id: 'goat', name: 'Black Goat', power: 0, health: 1, sigils: ['worthy-sacrifice'] },
      null,
      null,
    ],
  });
  const result = playCard(battle, 'urayuli', 2, [0, 1]);
  assert.equal(result.ok, true);
  assert.equal(result.state.playerLanes[0].name, 'Cat');
  assert.equal(result.state.playerLanes[1], null);
  assert.equal(result.state.playerLanes[2].name, 'Urayuli');
  assert.equal(result.state.bones, 1);
});

test('airborne damage bypasses ordinary blockers but mighty leap intercepts it', () => {
  const airborne = { id: 'raven', name: 'Raven', power: 2, health: 3, sigils: ['airborne'] };
  const blocker = { id: 'stump', name: 'Stump', power: 0, health: 3 };
  const leap = { id: 'bullfrog', name: 'Bullfrog', power: 1, health: 2, sigils: ['mighty-leap'] };

  const bypass = resolveCombat(createBattle({ playerLanes: [airborne], opponentLanes: [blocker] }), 'player');
  assert.equal(bypass.state.scale, 2);
  assert.equal(bypass.state.opponentLanes[0].health, 3);

  const intercepted = resolveCombat(createBattle({ playerLanes: [airborne], opponentLanes: [leap] }), 'player');
  assert.equal(intercepted.state.scale, 0);
  assert.equal(intercepted.state.opponentLanes[0], null);
});

test('player chooses exactly one card from the main or squirrel deck each turn', () => {
  const battle = createBattle({
    deck: [{ id: 'wolf', name: 'Wolf', power: 3, health: 2 }],
    sideDeck: [{ id: 'squirrel', name: 'Squirrel', power: 0, health: 1 }],
    hasDrawn: false,
  });
  const draw = drawCard(battle, 'side');
  assert.equal(draw.ok, true);
  assert.equal(draw.state.hand.at(-1).name, 'Squirrel');
  assert.equal(draw.state.sideDeck.length, 0);
  assert.equal(draw.state.deck.length, 1);
  const second = drawCard(draw.state, 'main');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'ALREADY_DREW');
});

test('bifurcated strike attacks adjacent lanes and never the forward lane', () => {
  const battle = createBattle({
    playerLanes: [null, { id: 'mantis', name: 'Mantis', power: 1, health: 1, sigils: ['bifurcated'] }],
    opponentLanes: [{ id: 'bee', name: 'Bee', power: 1, health: 1 }, { id: 'stump', name: 'Stump', power: 0, health: 3 }],
  });
  const result = resolveCombat(battle, 'player');
  assert.equal(result.state.opponentLanes[0], null);
  assert.equal(result.state.opponentLanes[1].health, 3);
  assert.equal(result.state.scale, 1);
});

test('touch of death kills a struck creature regardless of remaining health', () => {
  const battle = createBattle({
    playerLanes: [{ id: 'adder', name: 'Adder', power: 1, health: 1, sigils: ['touch-of-death'] }],
    opponentLanes: [{ id: 'grizzly', name: 'Grizzly', power: 4, health: 6 }],
  });
  const result = resolveCombat(battle, 'player');
  assert.equal(result.state.opponentLanes[0], null);
});

test('fledgling creatures mature after surviving their side turn', () => {
  const battle = createBattle({ playerLanes: [{ id: 'cub', key: 'wolfCub', name: 'Wolf Cub', power: 1, health: 1, sigils: ['fledgling'] }] });
  const aged = ageCards(battle, 'player');
  assert.equal(aged.playerLanes[0].name, 'Wolf');
  assert.equal(aged.playerLanes[0].power, 3);
  assert.equal(aged.playerLanes[0].health, 2);
  assert.equal(aged.playerLanes[0].sigils.includes('fledgling'), false);
});

test('an exhausted player can continue taking turns without an impossible draw', () => {
  const exhausted = beginPlayerTurn(createBattle({ turn: 4, deck: [], sideDeck: [], hasDrawn: false }));
  assert.equal(exhausted.turn, 5);
  assert.equal(exhausted.hasDrawn, true);

  const cardsRemain = beginPlayerTurn(createBattle({ turn: 4, deck: [{ id: 'wolf' }], sideDeck: [], hasDrawn: true }));
  assert.equal(cardsRemain.turn, 5);
  assert.equal(cardsRemain.hasDrawn, false);
});
