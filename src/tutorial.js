const STORAGE_KEY = 'bb_tutorial_completed';

export const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({ id: 'welcome', action: 'continue', title: 'Learn the table', copy: 'Enemy cards arrive face-up. You will make a real opening play, offer a creature, earn a Bone, and resolve combat.', spotlight: '#board' }),
  Object.freeze({ id: 'select-squirrel', action: 'select-card', target: 'squirrel', title: 'Start with the small creature', copy: 'Your opening Squirrel costs nothing. Select it from your hand.', spotlight: '.hand-card[data-key="squirrel"]' }),
  Object.freeze({ id: 'place-squirrel', action: 'place-lane', target: 0, title: 'Claim the first lane', copy: 'Place the Squirrel in your leftmost lane. It can block—or become an offering.', spotlight: '.lane.player[data-lane="0"]' }),
  Object.freeze({ id: 'select-stoat', action: 'select-card', target: 'stoat', title: 'Choose a Blood creature', copy: 'The red seal means Stoat costs one Blood. Select it now.', spotlight: '.hand-card[data-key="stoat"]' }),
  Object.freeze({ id: 'mark-sacrifice', action: 'mark-sacrifice', target: 0, title: 'Mark the offering', copy: 'Select the Squirrel on the table. It will provide the Blood Stoat requires.', spotlight: '.lane.player[data-lane="0"]' }),
  Object.freeze({ id: 'lock-offer', action: 'lock-offer', title: 'Confirm the offering', copy: 'Lock the offering. Nothing dies until you choose where the new card will land.', spotlight: '#offerButton' }),
  Object.freeze({ id: 'place-stoat', action: 'place-lane', target: 0, title: 'Replace sacrifice with strength', copy: 'Place Stoat into the same lane. The Squirrel dies, and you gain one Bone.', spotlight: '.lane.player[data-lane="0"]' }),
  Object.freeze({ id: 'explain-bones', action: 'continue', title: 'Death leaves Bones', copy: 'Your Bone pile increased. Bone-cost cards spend this reserve without sacrifices.', spotlight: '#boneReserve' }),
  Object.freeze({ id: 'ring-bell', action: 'ring-bell', title: 'Resolve the lanes', copy: 'Ring the brass bell. Your creatures attack first; unblocked Power tips the balance.', spotlight: '#bellButton' }),
  Object.freeze({ id: 'draw-squirrel', action: 'draw', target: 'side', title: 'Choose every later draw', copy: 'A new turn begins. Draw a dependable Squirrel; the other pile gives an unknown creature.', spotlight: '#sideDeck' }),
  Object.freeze({ id: 'complete', action: 'continue', title: 'The table is yours', copy: 'Read the incoming row, build toward five scale damage, and use the Rules book whenever a sigil is unfamiliar.', spotlight: '#board' }),
]);

export class TutorialController {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.active = false;
    this.index = 0;
  }

  isCompleted() {
    return this.storage?.getItem(STORAGE_KEY) === 'true';
  }

  shouldAutoStart() {
    return !this.isCompleted();
  }

  start() {
    this.index = 0;
    this.active = true;
    return this.current();
  }

  current() {
    return this.active ? TUTORIAL_STEPS[this.index] || null : null;
  }

  allows(action, target) {
    if (!this.active) return true;
    const step = this.current();
    return step?.action === action && (step.target === undefined || step.target === target);
  }

  perform(action, target) {
    if (!this.allows(action, target)) return false;
    this.index += 1;
    if (this.index >= TUTORIAL_STEPS.length) {
      this.storage?.setItem(STORAGE_KEY, 'true');
      this.active = false;
    }
    return true;
  }

  skip() {
    this.storage?.setItem(STORAGE_KEY, 'true');
    this.active = false;
  }

  replay() {
    this.storage?.removeItem(STORAGE_KEY);
    return this.start();
  }
}
