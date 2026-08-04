import { createCard } from './cards.js';
import { createBattle } from './core.js';

export const ENCOUNTER_SCRIPTS = Object.freeze([
  Object.freeze([
    [{ lane: 2, key: 'stoat' }],
    [],
    [{ lane: 0, key: 'bullfrog' }],
    [{ lane: 3, key: 'sparrow' }],
    [],
    [{ lane: 2, key: 'wolf' }],
  ]),
  Object.freeze([
    [{ lane: 1, key: 'opossum' }],
    [],
    [{ lane: 3, key: 'coyote' }],
    [],
    [{ lane: 2, key: 'raven' }],
    [{ lane: 1, key: 'adder' }, { lane: 3, key: 'opossum' }],
  ]),
  Object.freeze([
    [{ lane: 1, key: 'bullfrog' }],
    [],
    [{ lane: 0, key: 'raven' }],
    [],
    [{ lane: 2, key: 'wolf' }],
    [{ lane: 0, key: 'adder' }, { lane: 3, key: 'coyote' }],
  ]),
]);

export function previewForTurn(encounter, turn) {
  const script = ENCOUNTER_SCRIPTS[encounter] || ENCOUNTER_SCRIPTS[0];
  const row = script[(Math.max(1, turn) - 1) % script.length];
  return row.map(({ lane, key }) => ({ lane, card: createCard(key) }));
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
