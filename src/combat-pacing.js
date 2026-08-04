export const COMBAT_PACING = Object.freeze({
  phaseLead: 420,
  deployment: 700,
  scoreSettle: 700,
  emptyPhase: 420,
});

const EVENT_HOLDS = Object.freeze({
  strike: 500,
  death: 680,
  direct: 680,
});

export function pacingForEvent(event, reducedMotion = false) {
  const windup = 300;
  const hold = EVENT_HOLDS[event.type] ?? 460;
  if (!reducedMotion) return { windup, hold };
  return {
    windup: Math.max(80, Math.round(windup * 0.3)),
    hold: Math.max(140, Math.round(hold * 0.3)),
  };
}
