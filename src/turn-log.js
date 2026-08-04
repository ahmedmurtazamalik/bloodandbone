const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;
const names = values => values.length <= 1 ? (values[0] || 'a creature') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
const balanceText = scale => scale === 0 ? 'The scale is even.' : scale > 0 ? `You now lead by ${scale}.` : `The opponent now leads by ${Math.abs(scale)}.`;

export function describeEvent(event) {
  switch (event.type) {
    case 'battle-start': return `${event.encounterName} takes the opposite seat. Your opening hand contains ${event.handNames.join(', ')}.`;
    case 'preview': return event.cardNames.length ? `Incoming this turn: ${event.cardNames.join(', ')}.` : 'No enemy cards are incoming this turn.';
    case 'draw': return `You draw ${event.cardName} from the ${event.source === 'side' ? 'Squirrel' : 'creature'} deck.`;
    case 'sacrifice': {
      const boneCopy = event.bonesGained ? ` and gain ${plural(event.bonesGained, 'Bone')}` : '';
      const survivorCopy = event.survivorNames?.length ? ` ${names(event.survivorNames)} returns to the table through Many Lives.` : '';
      return `You offer ${names(event.cardNames)} for ${plural(event.blood, 'Blood')}${boneCopy}.${survivorCopy}`.trim();
    }
    case 'bone-spend': return `You spend ${plural(event.amount, 'Bone')} to summon ${event.cardName}.`;
    case 'play': return `You play ${event.cardName} in lane ${event.lane + 1}.`;
    case 'combat-start': return event.side === 'player' ? 'You ring the bell. Your creatures attack from left to right.' : 'The opponent’s creatures answer from left to right.';
    case 'strike': return `${event.defenderName} blocks ${event.attackerName} in lane ${event.lane + 1} and takes ${plural(event.damage, 'damage', 'damage')}${event.healthRemaining <= 0 ? ', killing it.' : `. ${event.defenderName} has ${plural(event.healthRemaining, 'health', 'health')} left.`}`;
    case 'death': return `${event.cardName} dies in lane ${event.lane + 1}.${event.boneGained ? ' You gain 1 Bone.' : ''}`;
    case 'direct': {
      const opening = event.bypassedDefenderName
        ? `${event.attackerName} flies over ${event.bypassedDefenderName} in lane ${event.lane + 1}`
        : `${event.attackerName} attacks through open lane ${event.lane + 1}`;
      return `${opening} for ${plural(event.damage, 'scale damage', 'scale damage')}. ${balanceText(event.scaleAfter)}`;
    }
    case 'deploy': return `The opponent sends ${event.cardName} into lane ${event.lane + 1}.`;
    case 'blocked-deploy': return `${event.cardName} cannot enter occupied lane ${event.lane + 1}; deployment fails.`;
    case 'mature': return `${event.side === 'player' ? 'Your' : 'The opponent’s'} ${event.beforeName} matures into ${event.afterName} in lane ${event.lane + 1}.`;
    case 'create-hand': return `${event.sourceName} opens a Rabbit Hole and adds ${event.cardName} to your hand.`;
    case 'fecundity': return `${event.cardName} creates one copy in your hand. The copy cannot replicate again.`;
    case 'return-hand': return `${event.cardName} is Unkillable and returns to your hand after ${event.reason === 'sacrifice' ? 'the sacrifice' : 'dying'}.`;
    case 'stinky': return `${event.sourceName}’s Stinky lowers ${event.attackerName} from ${event.powerBefore} Power to ${event.powerAfter} Power for this attack.`;
    case 'bones': return `${event.reason} ${event.amount > 0 ? (event.pluralSource ? 'add' : 'adds') : 'spends'} ${plural(Math.abs(event.amount), 'Bone')}. You have ${event.total}.`;
    case 'turn-ready': return event.drawRequired ? 'Choose either the creature deck or the Squirrel deck to begin your turn.' : 'Both draw piles are empty, so you may play or ring the bell immediately.';
    case 'victory': return `You win the trial with the scale at ${event.scale}.`;
    case 'defeat': return `The opponent wins the trial with the scale at ${event.scale}.`;
    case 'reward': return `${event.cardName} joins your deck for the remaining trials.`;
    default: return event.text || 'The table shifts.';
  }
}

const kindFor = type => ['strike','death','direct','combat-start'].includes(type) ? 'combat'
  : ['sacrifice','bone-spend','bones'].includes(type) ? 'resource'
    : ['victory','defeat','battle-start','turn-ready','preview'].includes(type) ? 'system' : 'action';

export class TurnLedger {
  constructor({ maxTurns = 8 } = {}) { this.maxTurns = maxTurns; this.turns = []; this.current = null; this.currentPhase = null; }

  clear() { this.turns = []; this.current = null; this.currentPhase = null; }

  beginTurn(turn) {
    this.current = { turn, phases: [] };
    this.turns.push(this.current);
    while (this.turns.length > this.maxTurns) this.turns.shift();
    this.beginPhase('player');
    return this.current;
  }

  beginPhase(side) {
    if (!this.current) this.beginTurn(1);
    const phase = { side, entries: [] };
    this.current.phases.push(phase);
    this.currentPhase = phase;
    return phase;
  }

  add(event, kind = kindFor(event.type)) { return this.addText(describeEvent(event), kind, event.type); }

  addText(text, kind = 'action', type = 'note') {
    if (!this.currentPhase) this.beginTurn(1);
    const entry = { text, kind, type };
    this.currentPhase.entries.push(entry);
    return entry;
  }

  snapshot() {
    return this.turns.map(turn => ({ turn: turn.turn, phases: turn.phases.map(phase => ({ side: phase.side, entries: phase.entries.map(entry => ({ ...entry })) })) }));
  }
}
