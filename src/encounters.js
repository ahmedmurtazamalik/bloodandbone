import { createCard } from './cards.js';
import { createBattle } from './core.js';

export const ENCOUNTER_SCRIPTS = Object.freeze([
  Object.freeze([
    [{ lane: 2, key: 'stoat' }],
    [{ lane: 0, key: 'beehive' }],
    [],
    [{ lane: 2, key: 'bullfrog' }],
    [{ lane: 0, key: 'riverSnapper' }],
    [{ lane: 0, key: 'sparrow' }],
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
    [],
    [{ lane: 2, key: 'riverSnapper' }],
    [{ lane: 1, key: 'raven' }],
    [],
    [{ lane: 3, key: 'adder' }, { lane: 0, key: 'opossum' }],
    [{ lane: 2, key: 'skunk' }],
    [{ lane: 0, key: 'coyote' }],
    [],
    [{ lane: 1, key: 'raven' }],
    [{ lane: 3, key: 'stoat' }],
    [],
    [{ lane: 2, key: 'adder' }, { lane: 0, key: 'coyote' }],
    [{ lane: 1, key: 'riverSnapper' }],
  ]),
  Object.freeze([
    [{ lane: 1, key: 'bullfrog' }],
    [{ lane: 3, key: 'skunk' }],
    [{ lane: 0, key: 'sparrow' }],
    [],
    [{ lane: 2, key: 'riverSnapper' }],
    [{ lane: 1, key: 'wolf' }],
    [],
    [{ lane: 0, key: 'adder' }, { lane: 3, key: 'coyote' }],
    [{ lane: 3, key: 'bullfrog' }],
    [{ lane: 0, key: 'beehive' }],
    [],
    [{ lane: 2, key: 'stoat' }, { lane: 0, key: 'sparrow' }],
    [{ lane: 3, key: 'riverSnapper' }],
    [],
    [{ lane: 1, key: 'adder' }, { lane: 3, key: 'coyote' }],
    [],
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
