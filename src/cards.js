const free = amount => Object.freeze({ type: 'free', amount });
const blood = amount => Object.freeze({ type: 'blood', amount });
const bones = amount => Object.freeze({ type: 'bones', amount });
const card = (name, cost, power, health, sigils = [], tribe = null, rarity = 'common') => Object.freeze({
  name, cost, power, health, sigils: Object.freeze(sigils), tribe, rarity,
});

export const CARD_LIBRARY = Object.freeze({
  squirrel: card('Squirrel', free(0), 0, 1, [], 'squirrel', 'token'),
  rabbit: card('Rabbit', free(0), 0, 1, [], null, 'token'),
  bee: card('Bee', free(0), 1, 1, ['airborne'], 'insect', 'token'),
  stoat: card('Stoat', blood(1), 1, 3, [], 'canine'),
  bullfrog: card('Bullfrog', blood(1), 1, 2, ['mighty-leap'], 'reptile'),
  wolfCub: card('Wolf Cub', blood(1), 1, 1, ['fledgling'], 'canine'),
  sparrow: card('Sparrow', blood(1), 1, 2, ['airborne'], 'avian'),
  kingfisher: card('Kingfisher', blood(1), 1, 1, ['airborne', 'waterborne'], 'avian'),
  cat: card('Cat', blood(1), 0, 1, ['many-lives'], 'feline'),
  blackGoat: card('Black Goat', blood(1), 0, 1, ['worthy-sacrifice'], 'hooved'),
  warren: card('Warren', blood(1), 0, 2, ['rabbit-hole'], null),
  beehive: card('Beehive', blood(1), 0, 2, ['bees-within'], 'insect'),
  mantis: card('Mantis', blood(1), 1, 1, ['bifurcated'], 'insect'),
  porcupine: card('Porcupine', blood(1), 1, 2, ['sharp-quills'], null),
  skunk: card('Skunk', blood(1), 0, 3, ['stinky'], 'canine'),
  wolf: card('Wolf', blood(2), 3, 2, [], 'canine'),
  riverSnapper: card('River Snapper', blood(2), 1, 6, [], 'reptile'),
  raven: card('Raven', blood(2), 2, 3, ['airborne'], 'avian'),
  elk: card('Elk', blood(2), 2, 4, ['sprinter'], 'hooved'),
  beaver: card('Beaver', blood(2), 1, 4, ['dam-builder'], null),
  adder: card('Adder', blood(2), 1, 1, ['touch-of-death'], 'reptile'),
  fieldMice: card('Field Mice', blood(2), 2, 2, ['fecundity'], 'rodent'),
  grizzly: card('Grizzly', blood(3), 4, 6, [], 'canine'),
  mooseBuck: card('Moose Buck', blood(3), 3, 7, ['hefty'], 'hooved'),
  opossum: card('Opossum', bones(2), 1, 1),
  coyote: card('Coyote', bones(4), 2, 1, [], 'canine'),
  cockroach: card('Cockroach', bones(4), 1, 1, ['unkillable'], 'insect'),
  corpseMaggots: card('Corpse Maggots', bones(5), 1, 2, ['corpse-eater'], 'insect'),
  rattler: card('Rattler', bones(6), 3, 1, [], 'reptile'),
  turkeyVulture: card('Turkey Vulture', bones(8), 3, 3, ['airborne'], 'avian'),
  mantisGod: card('Mantis God', blood(1), 1, 1, ['trifurcated'], 'insect', 'rare'),
  ouroboros: card('Ouroboros', blood(2), 1, 1, ['unkillable'], 'reptile', 'rare'),
});

export const STARTER_DECK = Object.freeze([
  'stoat', 'bullfrog', 'wolfCub', 'sparrow', 'blackGoat',
  'wolf', 'riverSnapper', 'opossum', 'coyote',
]);

let nextInstance = 1;
export function createCard(key) {
  const template = CARD_LIBRARY[key];
  if (!template) throw new Error(`Unknown card: ${key}`);
  return {
    ...template,
    key,
    id: `${key}-${nextInstance++}`,
    maxHealth: template.health,
    cost: { ...template.cost },
    sigils: [...template.sigils],
  };
}
