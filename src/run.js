import { STARTER_DECK } from './cards.js';

export const ENCOUNTERS = Object.freeze([
  Object.freeze({ name: 'THE WOODSMAN', subtitle: 'Teaches blood and open lanes' }),
  Object.freeze({ name: 'THE MARROW WITCH', subtitle: 'Pressures the bone economy' }),
  Object.freeze({ name: 'THE HORNED KING', subtitle: 'Tests every lane and sigil' }),
]);

export const REWARD_POOL = Object.freeze(['cat','blackGoat','mantis','adder','raven','riverSnapper','grizzly','rattler','turkeyVulture','mantisGod']);

function createRewardOffer(run, count = 3) {
  let available = REWARD_POOL.filter(key => !run.deck.includes(key) && !run.rewardHistory.includes(key));
  if (available.length < count) available = REWARD_POOL.filter(key => !run.deck.includes(key));
  if (available.length < count) available = [...REWARD_POOL];
  const start = Math.abs((run.rewardSeed * 7) + (run.victories * 3)) % available.length;
  return Array.from({ length: Math.min(count, available.length) }, (_, index) => available[(start + index) % available.length]);
}

export function createRun({ rewardSeed = 0 } = {}) {
  return { encounter: 0, phase: 'battle', deck: [...STARTER_DECK], victories: 0, rewardSeed, rewardHistory: [], rewardOptions: [] };
}

export function completeBattle(run, won) {
  if (!won) return { ...run, deck: [...run.deck], phase: 'defeat' };
  const victories = run.victories + 1;
  const next = {
    ...run,
    deck: [...run.deck],
    victories,
    phase: victories >= ENCOUNTERS.length ? 'victory' : 'reward',
  };
  if (next.phase !== 'reward') return { ...next, rewardOptions: [] };
  const rewardOptions = createRewardOffer(next);
  return { ...next, rewardOptions, rewardHistory: [...next.rewardHistory, ...rewardOptions] };
}

export function chooseReward(run, cardKey) {
  if (run.phase !== 'reward' || !run.rewardOptions.includes(cardKey)) return run;
  return {
    ...run,
    deck: [...run.deck, cardKey],
    encounter: Math.min(run.encounter + 1, ENCOUNTERS.length - 1),
    phase: 'battle',
    rewardOptions: [],
  };
}
