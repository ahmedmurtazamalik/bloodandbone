import assert from 'node:assert/strict';
import { CARD_LIBRARY, STARTER_DECK, createCard } from '../src/cards.js';
import { createBattle, drawCard, playCard, resolveCombat, ageCards, beginPlayerTurn, scoutDeck, chooseScoutedCard, maneuverCreature, mendCreature } from '../src/core.js';
import { previewForTurn, deployPreview } from '../src/encounters.js';
import { startingBonesForEncounter } from '../src/run.js';
import { judgeMatch } from '../src/match-rules.js';

const bloodValue = card => card.sigils?.includes('worthy-sacrifice') ? 3 : 1;

function openingBattle(encounter) {
  const earned = [[], ['mantis'], ['mantis', 'adder']][encounter];
  const cards = [...STARTER_DECK, ...earned].map(createCard);
  const fairIndex = cards.findIndex(card => card.cost.type === 'blood' && card.cost.amount === 1);
  const fair = cards.splice(fairIndex, 1)[0];
  return createBattle({
    hand: [createCard('squirrel'), fair, ...cards.splice(0, 2)],
    deck: cards,
    sideDeck: Array.from({ length: 9 }, () => createCard('squirrel')),
    bones: startingBonesForEncounter(encounter),
    hasDrawn: true,
    turn: 1,
  });
}

function openLanes(state) { return state.playerLanes.map((card, lane) => card ? -1 : lane).filter(lane => lane >= 0); }

function playGreedy(state, preview) {
  let next = state;
  for (const card of [...next.hand]) {
    if (card.cost.type !== 'free') continue;
    const open = openLanes(next);
    const activeThreat = open.filter(lane => next.opponentLanes[lane]).sort((a, b) => next.opponentLanes[b].power - next.opponentLanes[a].power)[0];
    const incomingThreat = preview.find(entry => open.includes(entry.lane))?.lane;
    const lane = activeThreat ?? incomingThreat ?? open[0]; if (lane == null) break;
    const result = playCard(next, card.id, lane); if (result.ok) next = result.state;
  }

  let changed = true;
  while (changed) {
    changed = false;
    const boneCard = [...next.hand].filter(card => card.cost.type === 'bones' && card.cost.amount <= next.bones).sort((a, b) => b.power - a.power)[0];
    if (boneCard && openLanes(next).length) {
      const result = playCard(next, boneCard.id, openLanes(next)[0]);
      if (result.ok) { next = result.state; changed = true; continue; }
    }
    const bloodCards = [...next.hand].filter(card => card.cost.type === 'blood').sort((a, b) => (b.power + b.health * .15) - (a.power + a.health * .15));
    for (const card of bloodCards) {
      const candidates = next.playerLanes.map((unit, lane) => ({ unit, lane })).filter(entry => entry.unit)
        .sort((a, b) => (a.unit.power + a.unit.health * .1) - (b.unit.power + b.unit.health * .1));
      const sacrifices = []; let value = 0;
      for (const entry of candidates) { sacrifices.push(entry.lane); value += bloodValue(entry.unit); if (value >= card.cost.amount) break; }
      if (value < card.cost.amount) continue;
      const lostPower = sacrifices.reduce((sum, lane) => sum + next.playerLanes[lane].power, 0);
      if (lostPower > 0 && card.power <= lostPower) continue;
      const legalTargets = next.playerLanes.map((unit, lane) => (!unit || sacrifices.includes(lane)) ? lane : -1).filter(lane => lane >= 0);
      const activeTarget = legalTargets.filter(lane => next.opponentLanes[lane]).sort((a, b) => next.opponentLanes[b].power - next.opponentLanes[a].power)[0];
      const incomingTarget = preview.find(entry => legalTargets.includes(entry.lane))?.lane;
      const target = activeTarget ?? incomingTarget ?? sacrifices[0] ?? openLanes(next)[0];
      const result = playCard(next, card.id, target, sacrifices);
      if (result.ok) { next = result.state; changed = true; break; }
    }
  }
  return next;
}

function useTactic(state, preview) {
  const threats = [...preview].sort((a, b) => b.card.power - a.card.power);
  for (const threat of threats) {
    if (state.playerLanes[threat.lane]) continue;
    for (const fromLane of [threat.lane - 1, threat.lane + 1]) {
      if (!state.playerLanes[fromLane]) continue;
      const moved = maneuverCreature(state, fromLane, threat.lane);
      if (moved.ok) return moved.state;
    }
  }
  const woundedLane = state.playerLanes
    .map((card, lane) => ({ card, lane }))
    .filter(({ card }) => card && card.health < card.maxHealth)
    .sort((a, b) => b.card.power - a.card.power)[0]?.lane;
  if (woundedLane != null && state.bones >= 2) {
    const mended = mendCreature(state, woundedLane);
    if (mended.ok) return mended.state;
  }
  return state;
}

function simulate(encounter) {
  let state = openingBattle(encounter);
  let preview = previewForTurn(encounter, 1);
  for (let round = 0; round < 20; round += 1) {
    if (!state.hasDrawn) {
      const shouldDrawSide = encounter === 0 ? state.turn % 3 !== 0 : state.turn % 2 === 0;
      const source = state.sideDeck.length && (shouldDrawSide || !state.deck.length) ? 'side' : 'main';
      const drawn = source === 'side' ? drawCard(state, source) : (() => {
        const scouted = scoutDeck(state);
        if (!scouted.ok) return scouted;
        const choice = [...scouted.options].sort((a, b) => (b.power * 2 + b.health) - (a.power * 2 + a.health))[0];
        return chooseScoutedCard(state, choice.id);
      })();
      if (drawn.ok) state = drawn.state;
      else if (!state.deck.length && !state.sideDeck.length) state.hasDrawn = true;
    }
    state = playGreedy(state, preview);
    state = useTactic(state, preview);

    let combat = resolveCombat(state, 'player'); state = combat.state;
    state = ageCards(state, 'opponent'); state = deployPreview(state, preview).state;
    combat = resolveCombat(state, 'opponent'); state = combat.state;
    const outcome = judgeMatch(state);
    if (outcome) return { winner: outcome.winner, reason: outcome.reason, turn: state.turn, scale: state.scale };
    state = beginPlayerTurn(ageCards(state, 'player'));
    preview = previewForTurn(encounter, state.turn);
  }
  return { winner: null, turn: state.turn, scale: state.scale };
}

for (let encounter = 0; encounter < 3; encounter += 1) {
  const result = simulate(encounter);
  assert.equal(result.winner, 'player', `encounter ${encounter + 1} was not bot-winnable: ${JSON.stringify(result)}`);
  console.log(`SIM ${encounter + 1} OK: player won on turn ${result.turn}, scale ${result.scale}`);
}
