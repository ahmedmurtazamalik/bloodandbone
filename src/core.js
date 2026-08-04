const LANES = 4;

const cloneCard = card => card ? { ...card, sigils: [...(card.sigils || [])] } : null;
const rabbitFrom = source => ({
  id: `rabbit-from-${source.id}`,
  key: 'rabbit',
  name: 'Rabbit',
  cost: { type: 'free', amount: 0 },
  power: 0,
  health: 1,
  sigils: [],
  tribe: null,
  rarity: 'token',
});
const fecundityCopyFrom = source => ({
  ...cloneCard(source),
  id: `fecundity-copy-${source.id}`,
  cost: { ...source.cost },
  sigils: (source.sigils || []).filter(sigil => sigil !== 'fecundity'),
});

export function createBattle(overrides = {}) {
  return {
    hand: (overrides.hand || []).map(cloneCard),
    deck: (overrides.deck || []).map(cloneCard),
    sideDeck: (overrides.sideDeck || []).map(cloneCard),
    playerLanes: Array.from({ length: LANES }, (_, index) => cloneCard(overrides.playerLanes?.[index])),
    opponentLanes: Array.from({ length: LANES }, (_, index) => cloneCard(overrides.opponentLanes?.[index])),
    bones: overrides.bones || 0,
    scale: overrides.scale || 0,
    hasDrawn: overrides.hasDrawn ?? false,
    turn: overrides.turn || 1,
  };
}

export function drawCard(state, source) {
  if (state.hasDrawn) return { ok: false, reason: 'ALREADY_DREW', state };
  const pileKey = source === 'side' ? 'sideDeck' : 'deck';
  if (!state[pileKey]?.length) return { ok: false, reason: 'PILE_EMPTY', state };
  const next = createBattle(state);
  next.hand.push(next[pileKey].shift());
  next.hasDrawn = true;
  return { ok: true, state: next };
}

export function beginPlayerTurn(state) {
  const next = createBattle(state);
  next.turn += 1;
  next.hasDrawn = next.deck.length === 0 && next.sideDeck.length === 0;
  return next;
}

export function playCard(state, cardId, lane, sacrificeLanes = []) {
  const cardIndex = state.hand.findIndex(card => card.id === cardId);
  if (cardIndex < 0 || lane < 0 || lane >= LANES) return { ok: false, reason: 'INVALID_PLAY', state };
  const card = state.hand[cardIndex];
  const cost = card.cost || { type: 'free', amount: 0 };
  const uniqueSacrifices = [...new Set(sacrificeLanes)];
  if (uniqueSacrifices.some(index => !state.playerLanes[index])) return { ok: false, reason: 'INVALID_SACRIFICE', state };
  const bloodOffered = uniqueSacrifices.reduce((total, index) => total + (state.playerLanes[index].sigils?.includes('worthy-sacrifice') ? 3 : 1), 0);
  if (cost.type === 'blood' && bloodOffered < cost.amount) return { ok: false, reason: 'NOT_ENOUGH_BLOOD', state };
  if (cost.type === 'bones' && state.bones < cost.amount) return { ok: false, reason: 'NOT_ENOUGH_BONES', state };
  if (state.playerLanes[lane] && !uniqueSacrifices.includes(lane)) return { ok: false, reason: 'LANE_OCCUPIED', state };

  const next = createBattle(state);
  if (cost.type === 'bones') next.bones -= cost.amount;
  for (const index of uniqueSacrifices) {
    if (next.playerLanes[index].sigils?.includes('many-lives')) continue;
    next.playerLanes[index] = null;
    next.bones += 1;
  }
  next.playerLanes[lane] = cloneCard(card);
  next.hand.splice(cardIndex, 1);
  const events = [];
  if (card.sigils?.includes('rabbit-hole')) {
    next.hand.push(rabbitFrom(card));
    events.push({ type: 'create-hand', sourceName: card.name, cardName: 'Rabbit' });
  }
  if (card.sigils?.includes('fecundity')) {
    next.hand.push(fecundityCopyFrom(card));
    events.push({ type: 'fecundity', cardName: card.name });
  }
  return { ok: true, state: next, events };
}

export function ageCards(state, side = 'player') {
  const next = createBattle(state);
  const lanes = side === 'player' ? next.playerLanes : next.opponentLanes;
  for (const card of lanes) {
    if (!card?.sigils?.includes('fledgling')) continue;
    card.sigils = card.sigils.filter(sigil => sigil !== 'fledgling');
    if (card.key === 'wolfCub') { card.name = 'Wolf'; card.power = 3; card.health += 1; }
    else { card.name = `Elder ${card.name}`; card.power += 1; card.health += 2; }
  }
  return next;
}

export function resolveCombat(state, side = 'player') {
  const next = createBattle(state);
  const attackers = side === 'player' ? next.playerLanes : next.opponentLanes;
  const defenders = side === 'player' ? next.opponentLanes : next.playerLanes;
  const events = [];
  for (let lane = 0; lane < LANES; lane += 1) {
    const attacker = attackers[lane];
    if (!attacker || attacker.power <= 0) continue;
    const offsets = attacker.sigils?.includes('trifurcated') ? [-1, 0, 1]
      : attacker.sigils?.includes('bifurcated') ? [-1, 1] : [0];
    for (const offset of offsets) {
      const targetLane = lane + offset;
      if (targetLane < 0 || targetLane >= LANES) continue;
      const defender = defenders[targetLane];
      const fliesOver = attacker.sigils?.includes('airborne') && !defender?.sigils?.includes('mighty-leap');
      if (defender && !fliesOver) {
        const defenderName = defender.name;
        const defenderKey = defender.key;
        defender.health -= attacker.power;
        if (attacker.sigils?.includes('touch-of-death')) defender.health = 0;
        events.push({ type: 'strike', side, lane: targetLane, sourceLane: lane, damage: attacker.power, attackerName: attacker.name, attackerKey: attacker.key, defenderName, defenderKey, healthRemaining: Math.max(0, defender.health), touchOfDeath: attacker.sigils?.includes('touch-of-death') || false });
        if (defender.health <= 0) {
          defenders[targetLane] = null;
          if (side === 'opponent') next.bones += 1;
          events.push({ type: 'death', side: side === 'player' ? 'opponent' : 'player', lane: targetLane, cardName: defenderName, cardKey: defenderKey, boneGained: side === 'opponent' });
        }
      } else {
        next.scale += side === 'player' ? attacker.power : -attacker.power;
        events.push({ type: 'direct', side, lane: targetLane, sourceLane: lane, damage: attacker.power, attackerName: attacker.name, attackerKey: attacker.key, bypassedDefenderName: fliesOver ? defender?.name : null, scaleAfter: next.scale });
      }
    }
  }
  return { state: next, events, winner: next.scale >= 5 ? 'player' : next.scale <= -5 ? 'opponent' : null };
}
