export const MATCH_RULES = Object.freeze({
  minimumTurns: 12,
  regulationTurns: 16,
  dominationMargin: 20,
});

export function judgeMatch({ turn, scale }) {
  if (turn < MATCH_RULES.minimumTurns) return null;
  if (Math.abs(scale) >= MATCH_RULES.dominationMargin) {
    return { winner: scale > 0 ? 'player' : 'opponent', reason: 'domination' };
  }
  if (turn < MATCH_RULES.regulationTurns || scale === 0) return null;
  return {
    winner: scale > 0 ? 'player' : 'opponent',
    reason: turn === MATCH_RULES.regulationTurns ? 'regulation' : 'sudden-death',
  };
}
