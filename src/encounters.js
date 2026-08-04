import { createCard } from './cards.js';
import { createBattle } from './core.js';

export const ENCOUNTER_SCRIPTS = Object.freeze([
  Object.freeze([
    [{ lane: 2, key: 'stoat' }],
    [{ lane: 0, key: 'coyote' }],
    [],
    [{ lane: 2, key: 'raven' }],
    [{ lane: 0, key: 'riverSnapper' }],
    [{ lane: 0, key: 'wolfCub' }],
    [],
    [{ lane: 3, key: 'beehive' }],
    [{ lane: 1, key: 'bullfrog' }],
    [{ lane: 3, key: 'coyote' }],
    [],
    [{ lane: 0, key: 'stoat' }, { lane: 3, key: 'sparrow' }],
    [{ lane: 1, key: 'riverSnapper' }],
    [],
    [{ lane: 2, key: 'beehive' }],
    [],
  ]),
  Object.freeze([
    [{ lane: 1, key: 'opossum' }],
    [{ lane: 3, key: 'skunk' }],
    [{ lane: 0, key: 'coyote' }],
    [{ lane: 2, key: 'raven' }],
    [{ lane: 2, key: 'riverSnapper' }],
    [{ lane: 1, key: 'raven' }],
    [{ lane: 3, key: 'opossum' }],
    [{ lane: 0, key: 'opossum' }],
    [{ lane: 2, key: 'skunk' }],
    [{ lane: 0, key: 'coyote' }],
    [],
    [{ lane: 1, key: 'beehive' }],
    [],
    [],
    [{ lane: 2, key: 'adder' }],
    [{ lane: 1, key: 'riverSnapper' }],
  ]),
  Object.freeze([
    [{ lane: 1, key: 'bullfrog' }],
    [{ lane: 3, key: 'skunk' }],
    [{ lane: 0, key: 'sparrow' }],
    [{ lane: 2, key: 'sparrow' }],
    [{ lane: 2, key: 'riverSnapper' }],
    [{ lane: 1, key: 'wolf' }],
    [],
    [{ lane: 0, key: 'adder' }, { lane: 3, key: 'coyote' }],
    [{ lane: 3, key: 'bullfrog' }],
    [{ lane: 0, key: 'beehive' }],
    [],
    [{ lane: 2, key: 'stoat' }],
    [{ lane: 3, key: 'riverSnapper' }],
    [],
    [{ lane: 1, key: 'adder' }, { lane: 3, key: 'coyote' }],
    [],
  ]),
]);

function deploymentScore(card, lane, authoredLane, state) {
  const target = state.playerLanes[lane];
  const distancePenalty = Math.abs(lane - authoredLane) * 0.25;
  if (!target) return card.power * 2 + 4 - distancePenalty;
  const lethalBonus = card.power >= target.health ? 4 : 0;
  return target.power * 2 + target.health + lethalBonus - distancePenalty;
}

export function previewForTurn(encounter, turn, state = null) {
  const script = ENCOUNTER_SCRIPTS[encounter] || ENCOUNTER_SCRIPTS[0];
  const row = script[(Math.max(1, turn) - 1) % script.length];
  const incoming = row.map(({ lane, key }) => ({ lane, card: createCard(key) }));
  if (!state) return incoming;

  const reserved = new Set();
  return incoming.map(entry => {
    const authoredLaneIsOpen = !state.opponentLanes[entry.lane] && !reserved.has(entry.lane);
    const candidates = [entry.lane - 1, entry.lane + 1]
      .filter(lane => lane >= 0 && lane < 4 && !state.opponentLanes[lane] && !reserved.has(lane))
      .sort((a, b) => deploymentScore(entry.card, b, entry.lane, state) - deploymentScore(entry.card, a, entry.lane, state) || a - b);
    const lane = authoredLaneIsOpen ? entry.lane : candidates[0] ?? entry.lane;
    reserved.add(lane);
    return { ...entry, lane };
  });
}

export function deployPreview(state, preview) {
  const next = createBattle(state);
  const blocked = [];
  for (const { lane, card } of preview) {
    if (next.opponentLanes[lane]) blocked.push(lane);
    else next.opponentLanes[lane] = { ...card, sigils: [...(card.sigils || [])] };
  }
  return { state: next, blocked };
}
