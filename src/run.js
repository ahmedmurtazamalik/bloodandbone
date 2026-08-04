import { STARTER_DECK } from './cards.js';

export const ENCOUNTERS = Object.freeze([
  Object.freeze({ name: 'THE WOODSMAN', subtitle: 'Teaches blood and open lanes' }),
  Object.freeze({ name: 'THE MARROW WITCH', subtitle: 'Pressures the bone economy' }),
  Object.freeze({ name: 'THE HORNED KING', subtitle: 'Tests every lane and sigil' }),
]);

export function createRun() {
  return { encounter: 0, phase: 'battle', deck: [...STARTER_DECK], victories: 0 };
}

export function completeBattle(run, won) {
  if (!won) return { ...run, deck: [...run.deck], phase: 'defeat' };
  const victories = run.victories + 1;
  return {
    ...run,
    deck: [...run.deck],
    victories,
    phase: victories >= ENCOUNTERS.length ? 'victory' : 'reward',
  };
}

export function chooseReward(run, cardKey) {
  if (run.phase !== 'reward') return run;
  return {
    ...run,
    deck: [...run.deck, cardKey],
    encounter: Math.min(run.encounter + 1, ENCOUNTERS.length - 1),
    phase: 'battle',
  };
}
