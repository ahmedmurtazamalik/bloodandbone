import { resolveCombat, ageCards, beginPlayerTurn } from './core.js';
import { deployPreview } from './encounters.js';
import { judgeMatch } from './match-rules.js';

function maturationEvents(before, after, side) {
  const events = [];
  before.forEach((card, lane) => {
    const matured = after[lane];
    if (card?.sigils?.includes('fledgling') && matured && !matured.sigils?.includes('fledgling')) {
      events.push({ type: 'mature', beforeName: card.name, afterName: matured.name, lane, side });
    }
  });
  return events;
}

function checkpoint(type, state, events = []) {
  return { type, state, events: events.map(event => ({ ...event, phase: type })) };
}

export function advanceRound(battle, preview = []) {
  const phases = [];

  const playerCombat = resolveCombat(battle, 'player');
  phases.push(checkpoint('player-combat', playerCombat.state, [
    { type: 'combat-start', side: 'player' },
    ...playerCombat.events,
  ]));

  const opponentBeforeAge = playerCombat.state.opponentLanes;
  const opponentAged = ageCards(playerCombat.state, 'opponent');
  phases.push(checkpoint(
    'opponent-maturation',
    opponentAged,
    maturationEvents(opponentBeforeAge, opponentAged.opponentLanes, 'opponent'),
  ));

  const deployment = deployPreview(opponentAged, preview);
  const blocked = new Set(deployment.blocked);
  phases.push(checkpoint('opponent-deployment', deployment.state, preview.map(entry => ({
    type: blocked.has(entry.lane) ? 'blocked-deploy' : 'deploy',
    cardName: entry.card.name,
    lane: entry.lane,
  }))));

  const opponentCombat = resolveCombat(deployment.state, 'opponent');
  phases.push(checkpoint('opponent-combat', opponentCombat.state, [
    { type: 'combat-start', side: 'opponent' },
    ...opponentCombat.events,
  ]));

  const settledState = opponentCombat.state;
  const outcome = judgeMatch(settledState);
  if (outcome) {
    return {
      phases,
      transcript: phases.flatMap(phase => phase.events),
      settledState,
      nextState: settledState,
      outcome,
      blockedDeployments: deployment.blocked,
    };
  }

  const playerBeforeAge = settledState.playerLanes;
  const playerAged = ageCards(settledState, 'player');
  phases.push(checkpoint(
    'player-maturation',
    playerAged,
    maturationEvents(playerBeforeAge, playerAged.playerLanes, 'player'),
  ));

  const nextState = beginPlayerTurn(playerAged);
  phases.push(checkpoint('turn-start', nextState));

  return {
    phases,
    transcript: phases.flatMap(phase => phase.events),
    settledState,
    nextState,
    outcome: null,
    blockedDeployments: deployment.blocked,
  };
}
