import { CARD_LIBRARY, STARTER_DECK, createCard } from './cards.js';
import { createBattle, drawCard, playCard, maneuverCreature, mendCreature, scoutDeck, chooseScoutedCard } from './core.js';
import { createRun, completeBattle, chooseReward, retryBattle, ENCOUNTERS, startingBonesForEncounter, startingBonesForRun } from './run.js';
import { previewForTurn } from './encounters.js';
import { CARD_ART } from './illustrations.js';
import { TutorialController, TUTORIAL_STEPS } from './tutorial.js';
import { AudioDirector } from './audio.js';
import { TurnLedger } from './turn-log.js';
import { COMBAT_PACING, pacingForEvent } from './combat-pacing.js';
import { MATCH_RULES } from './match-rules.js';
import { advanceRound } from './round-coordinator.js';

const ui = Object.fromEntries([
  'titleScreen','tableScreen','rewardScreen','resultScreen','startButton','tutorialButton','restartButton','trialLabel','opponentName','opponentSubtitle','scaleBeam','scaleReadout','enemyWeights','playerWeights','boneReserve','bonePile','bonesReadout','turnReadout','phaseReadout','previewRow','opponentRow','playerRow','enemyPower','mainDeck','sideDeck','mainCount','sideCount','hand','instruction','bellButton','maneuverButton','mendButton','actionTray','selectionSummary','offerButton','cancelButton','rewardChoices','scoutDialog','scoutChoices','rulesButton','rulesDialog','sigilGlossary','replayTutorial','audioButton','audioIcon','audioDialog','muteButton','musicVolume','musicValue','sfxVolume','sfxValue','ledgerPanel','ledgerToggle','turnLog','tutorialOverlay','tutorialProgress','tutorialTitle','tutorialCopy','tutorialContinue','tutorialSkip','resultEyebrow','resultTitle','resultCopy','toast','board','menuButton','pauseDialog','resumeButton','titleRulesButton','titleAudioButton','ledgerButton','ledgerDialog','deckViewButton','deckDialog','deckChoices','fullscreenButton','cardInspector','inspectorCard','inspectorDetails','inspectorClose','inspectButton','handPrevious','handNext','handPageReadout',
].map(id => [id, document.getElementById(id)]));

const SIGILS = Object.freeze({
  'airborne': ['AIR', 'Airborne', 'Strikes over ordinary blockers for direct scale damage.'],
  'mighty-leap': ['LEAP', 'Mighty Leap', 'Blocks opposing Airborne creatures.'],
  'touch-of-death': ['DEATH', 'Touch of Death', 'Any creature struck by this card dies.'],
  'many-lives': ['∞', 'Many Lives', 'Survives being offered as a sacrifice.'],
  'worthy-sacrifice': ['III', 'Worthy Sacrifice', 'Provides three blood when offered.'],
  'bifurcated': ['↙↘', 'Bifurcated Strike', 'Attacks the lanes to the left and right.'],
  'trifurcated': ['3X', 'Trifurcated Strike', 'Attacks left, forward, and right.'],
  'fledgling': ['↑', 'Fledgling', 'Matures after surviving its side turn.'],
  'rabbit-hole': ['RAB', 'Rabbit Hole', 'Playing Warren adds a free 0/1 Rabbit to your hand.'],
  'fecundity': ['COPY', 'Fecundity', 'Adds one matching copy to your hand; that copy cannot replicate again.'],
  'unkillable': ['∞', 'Unkillable', 'Returns to your hand at printed Health after it dies or is sacrificed.'],
  'stinky': ['−1', 'Stinky', 'Lowers the directly opposing attacker’s Power by one, to a minimum of zero.'],
});


let scene = 'title';
let run = null;
let battle = null;
let preview = [];
let rewardKeys = [];
let scoutOptions = [];
let selectedId = null;
let sacrificeLanes = [];
let selectionStage = null;
let tacticMode = null;
let tacticSourceLane = null;
let busy = false;
let toastTimer = null;
let renderedScene = null;
let handPage = 0;
let suppressInspection = false;
let inspectorPinned = false;
let inspectorOrigin = null;
let inspectorHideTimer = null;
let lastInteraction = 'keyboard';
let lastPointerPosition = null;
let dismissedPointerPosition = null;
let suppressPassiveHover = false;
const dialogReturnFocus = new Map();
const compactHand = window.matchMedia('(max-width: 600px)');
const handLimit = () => compactHand.matches ? 5 : 7;
const inspectorHome = ui.cardInspector.parentElement;
const tutorial = new TutorialController();
const audio = new AudioDirector();
const ledger = new TurnLedger({ maxTurns: 8 });
let renderedLogEntries = 0;
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const pacingWait = ms => wait(reducedMotion ? Math.max(100, Math.round(ms * .3)) : ms);
const sigilsOf = card => card?.sigils || [];
const bloodValue = card => sigilsOf(card).includes('worthy-sacrifice') ? 3 : 1;
const newRewardSeed = () => globalThis.crypto?.getRandomValues
  ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
  : Math.floor(Math.random() * 0xFFFFFFFF);

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showToast(message) {
  ui.toast.textContent = message; ui.toast.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1800);
}

function startRun(guided = false) {
  audio.unlock(); audio.startMusic().then(renderAudioControls); audio.playCue('ui');
  if (guided && !tutorial.active) tutorial.start();
  run = createRun({ rewardSeed: newRewardSeed() });
  startBattle();
}

function startBattle() {
  if (run.encounter > 0 && tutorial.active) tutorial.skip();
  const deck = shuffle(run.deck.map(createCard));
  let hand;
  if (tutorial.active && run.encounter === 0) {
    const take = key => {
      const index = deck.findIndex(card => card.key === key);
      return index >= 0 ? deck.splice(index, 1)[0] : createCard(key);
    };
    hand = [createCard('squirrel'), take('stoat'), take('wolfCub'), take('opossum')];
  } else {
    const fairIndex = deck.findIndex(card => card.cost.type === 'blood' && card.cost.amount === 1);
    const fairCard = fairIndex >= 0 ? deck.splice(fairIndex, 1)[0] : deck.shift();
    hand = [createCard('squirrel'), fairCard, ...deck.splice(0, 2)].filter(Boolean);
  }
  const sideDeck = Array.from({ length: 9 }, () => createCard('squirrel'));
  const marrowBones = startingBonesForEncounter(run.encounter);
  const startingBones = startingBonesForRun(run);
  battle = createBattle({ hand, deck, sideDeck, bones: startingBones, hasDrawn: true, turn: 1 });
  preview = previewForTurn(run.encounter, 1);
  ledger.clear(); renderedLogEntries = 0; ledger.beginTurn(1);
  ledger.add({ type: 'battle-start', encounterName: ENCOUNTERS[run.encounter].name, handNames: hand.map(card => card.name), deckNames: run.deck.map(key => CARD_LIBRARY[key]?.name || key) });
  ledger.add({ type: 'bones', reason: 'The Marrow Reserve', amount: marrowBones, total: marrowBones });
  if (run.losses) ledger.add({ type: 'bones', reason: 'Broken Bones', amount: 2, total: startingBones, pluralSource: true });
  ledger.add({ type: 'preview', cardNames: preview.map(entry => `${entry.card.name} in lane ${entry.lane + 1}`) });
  selectedId = null; sacrificeLanes = []; selectionStage = null; tacticMode = null; tacticSourceLane = null; scoutOptions = []; busy = false;
  handPage = 0; closeInspector();
  if (ui.scoutDialog.open) ui.scoutDialog.close();
  scene = 'battle'; render();
}

function tutorialAllows(action, target) {
  if (tutorial.allows(action, target)) return true;
  showToast(`GUIDED HAND: ${tutorial.current()?.copy || 'FOLLOW THE HIGHLIGHTED STEP'}`);
  audio.playCue('invalid');
  return false;
}

function advanceTutorial(action, target) {
  if (!tutorial.active) return;
  tutorial.perform(action, target);
}

function draw(source) {
  if (busy || scene !== 'battle') return;
  if (!tutorialAllows('draw', source)) return;
  if (source === 'main') {
    const result = scoutDeck(battle);
    if (!result.ok) { showToast(result.reason === 'ALREADY_DREW' ? 'YOU HAVE ALREADY DRAWN THIS TURN' : 'THAT PILE IS EMPTY'); audio.playCue('invalid'); return; }
    scoutOptions = result.options;
    renderScoutChoices();
    audio.playCue('draw');
    ui.scoutDialog.showModal();
    return;
  }
  const result = drawCard(battle, source);
  if (!result.ok) { showToast(result.reason === 'ALREADY_DREW' ? 'YOU HAVE ALREADY DRAWN THIS TURN' : 'THAT PILE IS EMPTY'); audio.playCue('invalid'); return; }
  battle = result.state; ledger.add({ type: 'draw', cardName: battle.hand.at(-1).name, source });
  ensureHandCardVisible(battle.hand.at(-1).id);
  advanceTutorial('draw', source); audio.playCue('draw'); render();
  if (!tutorial.active) focusHandCard(battle.hand.at(-1).id);
}

function chooseScout(cardId) {
  const result = chooseScoutedCard(battle, cardId);
  if (!result.ok) { showToast('THAT CREATURE IS NO LONGER AVAILABLE'); audio.playCue('invalid'); return; }
  const chosen = result.state.hand.at(-1);
  battle = result.state;
  ensureHandCardVisible(chosen.id);
  ledger.add({ type: 'scout', cardNames: scoutOptions.map(card => card.name), chosenName: chosen.name });
  advanceTutorial('draw', 'main');
  scoutOptions = [];
  ui.scoutDialog.close();
  audio.playCue('draw'); render();
  if (!tutorial.active) focusHandCard(chosen.id);
}

function selectCard(cardId) {
  if (busy) return;
  if (!battle.hasDrawn) { showToast('CHOOSE A DRAW PILE FIRST'); return; }
  const card = battle.hand.find(item => item.id === cardId); if (!card) return;
  if (!tutorialAllows('select-card', card.key)) return;
  if (selectedId === cardId) { clearSelection(); return; }
  if (card.cost.type === 'bones' && battle.bones < card.cost.amount) {
    showToast('NOT ENOUGH BONES');
    audio.playCue('invalid');
    clearSelection();
    return;
  }
  selectedId = cardId; sacrificeLanes = []; tacticMode = null; tacticSourceLane = null;
  selectionStage = card.cost.type === 'blood' && card.cost.amount > 0 ? 'sacrifice' : 'place';
  ensureHandCardVisible(card.id);
  advanceTutorial('select-card', card.key); audio.playCue('select'); render();
}

function focusWithoutInspection(target) {
  if (!target) return;
  suppressInspection = true;
  target.focus({ preventScroll: true });
  suppressInspection = false;
}

function ensureHandCardVisible(cardId) {
  const index = battle?.hand.findIndex(card => card.id === cardId) ?? -1;
  if (index >= 0) handPage = Math.floor(index / handLimit());
}

function focusHandCard(cardId) {
  focusWithoutInspection([...ui.hand.querySelectorAll('.hand-card')].find(button => button.dataset.id === cardId));
}

function focusBattleAction() {
  const target = ui.hand.querySelector('.hand-card:not(:disabled)') || [ui.mainDeck, ui.sideDeck, ui.bellButton].find(button => !button.disabled);
  focusWithoutInspection(target);
}

function clearSelection() {
  const returnFocus = ui.actionTray.contains(document.activeElement);
  const previousCardId = selectedId;
  const previousTactic = tacticMode;
  selectedId = null; sacrificeLanes = []; selectionStage = null; tacticMode = null; tacticSourceLane = null; render();
  if (returnFocus) {
    if (previousCardId) focusHandCard(previousCardId);
    else if (previousTactic) focusWithoutInspection(previousTactic === 'maneuver' ? ui.maneuverButton : ui.mendButton);
  }
}

function selectedCard() { return battle?.hand.find(card => card.id === selectedId) || null; }
function offeredBlood() { return sacrificeLanes.reduce((sum, lane) => sum + bloodValue(battle.playerLanes[lane]), 0); }

function laneClick(lane) {
  if (busy) return;
  if (tacticMode === 'maneuver') {
    if (tacticSourceLane == null) {
      if (!battle.playerLanes[lane]) { showToast('CHOOSE ONE OF YOUR CREATURES'); return; }
      tacticSourceLane = lane; audio.playCue('select'); render(); return;
    }
    const result = maneuverCreature(battle, tacticSourceLane, lane);
    if (!result.ok) { showToast(result.reason.replaceAll('_', ' ')); audio.playCue('invalid'); return; }
    battle = result.state; ledger.add(result.event); audio.playCue('place'); clearSelection(); return;
  }
  if (tacticMode === 'mend') {
    const result = mendCreature(battle, lane);
    if (!result.ok) { showToast(result.reason.replaceAll('_', ' ')); audio.playCue('invalid'); return; }
    battle = result.state; ledger.add(result.event); audio.playCue('bones'); clearSelection(); return;
  }
  if (!selectedId) return;
  const card = selectedCard(); if (!card) return;
  if (selectionStage === 'sacrifice') {
    if (!battle.playerLanes[lane]) { showToast('ONLY CREATURES CAN BE OFFERED'); return; }
    if (!tutorialAllows('mark-sacrifice', lane)) return;
    sacrificeLanes = sacrificeLanes.includes(lane) ? sacrificeLanes.filter(value => value !== lane) : [...sacrificeLanes, lane];
    advanceTutorial('mark-sacrifice', lane); audio.playCue('select'); render(); return;
  }
  if (!tutorialAllows('place-lane', lane)) return;
  const legal = !battle.playerLanes[lane] || sacrificeLanes.includes(lane);
  if (!legal) { showToast('THAT LANE IS OCCUPIED'); return; }
  const previousBones = battle.bones;
  const usedSacrifice = sacrificeLanes.length > 0;
  const spentBones = card.cost.type === 'bones';
  const sacrificeCards = sacrificeLanes.map(index => battle.playerLanes[index]).filter(Boolean);
  const bloodOffered = sacrificeCards.reduce((sum, sacrifice) => sum + bloodValue(sacrifice), 0);
  const result = playCard(battle, card.id, lane, sacrificeLanes);
  if (!result.ok) { showToast(result.reason.replaceAll('_', ' ')); audio.playCue('invalid'); return; }
  battle = result.state; advanceTutorial('place-lane', lane);
  if (usedSacrifice) {
    const survivorNames = sacrificeCards.filter(sacrifice => battle.playerLanes.some(occupant => occupant?.id === sacrifice.id)).map(sacrifice => sacrifice.name);
    const bonesGained = battle.bones - previousBones;
    ledger.add({ type: 'sacrifice', cardNames: sacrificeCards.map(sacrifice => sacrifice.name), blood: bloodOffered, bonesGained, survivorNames });
  }
  if (spentBones) ledger.add({ type: 'bone-spend', amount: card.cost.amount, cardName: card.name });
  ledger.add({ type: 'play', cardName: card.name, lane });
  result.events?.forEach(event => ledger.add(event));
  if (usedSacrifice) audio.playCue('sacrifice');
  if (spentBones) audio.playCue('boneSpend');
  if (battle.bones > previousBones) setTimeout(() => audio.playCue('boneGain'), 90);
  setTimeout(() => { audio.playCue('place'); audio.playCreature(card.key); }, usedSacrifice ? 130 : 0);
  clearSelection();
}

function chooseTactic(mode) {
  if (busy || scene !== 'battle' || tutorial.active) return;
  if (battle.tacticUsed) { showToast('TACTIC ALREADY USED THIS TURN'); audio.playCue('invalid'); return; }
  selectedId = null; sacrificeLanes = []; selectionStage = null;
  tacticMode = tacticMode === mode ? null : mode;
  tacticSourceLane = null;
  audio.playCue('select'); render();
}

function lockOffering() {
  const card = selectedCard(); if (!card || offeredBlood() < card.cost.amount) return;
  if (!tutorialAllows('lock-offer')) return;
  const moveFocus = document.activeElement === ui.offerButton;
  advanceTutorial('lock-offer');
  selectionStage = 'place'; audio.playCue('ui'); render();
  if (moveFocus) focusWithoutInspection(ui.playerRow.querySelector('.can-target'));
}

async function ringBell() {
  if (busy || !battle.hasDrawn) { showToast('DRAW BEFORE ENDING THE TURN'); return; }
  if (!tutorialAllows('ring-bell')) return;
  advanceTutorial('ring-bell');
  busy = true; closeInspector(); selectedId = null; sacrificeLanes = []; selectionStage = null; tacticMode = null; tacticSourceLane = null; render();
  ui.bellButton.classList.add('ringing'); setTimeout(() => ui.bellButton.classList.remove('ringing'), 760);
  audio.playCue('bell');

  const resolvedRound = advanceRound(battle, preview);
  const phase = type => resolvedRound.phases.find(entry => entry.type === type);
  const playerCombat = phase('player-combat');
  const opponentMaturation = phase('opponent-maturation');
  const deployment = phase('opponent-deployment');
  const opponentCombat = phase('opponent-combat');

  playerCombat.events.filter(event => event.type === 'combat-start').forEach(event => ledger.add(event));
  renderTurnLog();
  await pacingWait(COMBAT_PACING.phaseLead);
  await animateEvents(playerCombat.events.filter(event => event.type !== 'combat-start'), 'player');
  battle = playerCombat.state; render(); await pacingWait(COMBAT_PACING.scoreSettle);

  ledger.beginPhase('opponent');
  battle = opponentMaturation.state;
  opponentMaturation.events.forEach(event => ledger.add(event));
  battle = deployment.state; render();
  deployment.events.forEach(event => ledger.add(event));
  const entering = preview.find(entry => !resolvedRound.blockedDeployments.includes(entry.lane));
  if (entering) { audio.playCue('place', .7); setTimeout(() => audio.playCreature(entering.card.key), 80); }
  if (resolvedRound.blockedDeployments.length) showToast('AN INCOMING CREATURE CANNOT ENTER ITS OCCUPIED LANE');
  await pacingWait(COMBAT_PACING.deployment);

  opponentCombat.events.filter(event => event.type === 'combat-start').forEach(event => ledger.add(event));
  renderTurnLog();
  await pacingWait(COMBAT_PACING.phaseLead);
  await animateEvents(opponentCombat.events.filter(event => event.type !== 'combat-start'), 'opponent');
  battle = opponentCombat.state; render(); await pacingWait(COMBAT_PACING.scoreSettle);

  if (resolvedRound.outcome) { finishBattle(resolvedRound.outcome.winner === 'player'); return; }

  const playerMaturation = phase('player-maturation');
  playerMaturation.events.forEach(event => ledger.add(event));
  battle = phase('turn-start').state;
  ledger.beginTurn(battle.turn);
  preview = previewForTurn(run.encounter, battle.turn, battle);
  ledger.add({ type: 'preview', cardNames: preview.map(entry => `${entry.card.name} in lane ${entry.lane + 1}`) });
  ledger.add({ type: 'turn-ready', drawRequired: !battle.hasDrawn });
  busy = false; render();
}

async function animateEvents(events, side) {
  if (!events.length) {
    ledger.addText(side === 'player' ? 'None of your creatures can attack.' : 'No opposing creature can attack.', 'combat');
    renderTurnLog(); await pacingWait(COMBAT_PACING.emptyPhase); return;
  }
  for (const event of events) {
    const timing = pacingForEvent(event, reducedMotion);
    if (!['strike', 'death', 'direct'].includes(event.type)) {
      ledger.add(event); renderTurnLog();
      audio.playCue('ui'); await wait(timing.hold); continue;
    }
    const defendingRow = side === 'player' ? ui.opponentRow : ui.playerRow;
    const attackingRow = side === 'player' ? ui.playerRow : ui.opponentRow;
    const lane = defendingRow.children[event.lane];
    const attackerLane = attackingRow.children[event.sourceLane ?? event.lane];
    if (event.type !== 'death') attackerLane?.classList.add('attacking');
    await wait(timing.windup);
    ledger.add(event); renderTurnLog();
    attackerLane?.classList.remove('attacking'); lane?.classList.add('flash'); ui.board.classList.add('impact');
    if (event.type === 'strike') {
      const health = lane?.querySelector('.health .stat-value');
      if (health) health.textContent = event.healthRemaining;
    }
    if (event.type === 'death') lane?.classList.add('dying');
    if (event.type === 'direct') renderScale(event.scaleAfter);
    if (event.type === 'direct') { audio.playCue('direct', side === 'player' ? .82 : 1.12); audio.playCue('scale', .75); }
    else audio.playCue(event.type === 'death' ? 'bones' : 'hit');
    await wait(timing.hold);
    lane?.classList.remove('flash'); lane?.classList.remove('dying'); ui.board.classList.remove('impact');
  }
}

function finishBattle(won) {
  if (won && tutorial.active) tutorial.skip();
  ledger.add({ type: won ? 'victory' : 'defeat', scale: battle.scale }); renderTurnLog();
  busy = false; run = completeBattle(run, won);
  if (run.phase === 'reward') {
    scene = 'reward'; rewardKeys = [...run.rewardOptions];
  } else if (run.phase === 'victory') scene = 'victory';
  else if (run.phase === 'retry') scene = 'retry';
  else scene = 'defeat';
  if (scene === 'reward') audio.playCue('reward');
  else if (scene === 'victory') { audio.playCue('victory'); audio.fadeMusic(audio.settings.musicVolume * .38, 1200); }
  else { audio.playCue('defeat'); audio.fadeMusic(audio.settings.musicVolume * .24, 900); }
  render();
}


function takeReward(key) {
  if (scene !== 'reward') return;
  if (tutorial.active) tutorial.skip();
  run = chooseReward(run, key); audio.playCue('reward'); audio.playCreature(key); startBattle();
}

function cardDescription(card) {
  const cost = card.cost.type === 'free' ? 'Free to play' : `Costs ${card.cost.amount} ${card.cost.type === 'blood' ? 'Blood' : 'Bones'}`;
  const abilities = sigilsOf(card).filter(sigil => SIGILS[sigil]).map(sigil => `${SIGILS[sigil][1]}: ${SIGILS[sigil][2]}`);
  return `${card.name}. ${card.power} Power, ${card.health} Health. ${cost}.${abilities.length ? ` ${abilities.join(' ')}` : ''}`;
}

const ICON_PATHS = Object.freeze({
  blood: '<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  bones: '<path d="m7 5 12 12c3-1 4 3 2 4s-4 1-4-2L5 7C2 8 1 4 3 3s4-1 4 2Z"/>',
  power: '<path d="m5 19 13-13 3-4-4 3L4 18m1-7 8 8m-9-1-2 4 4-2"/>',
  health: '<path d="M12 21 3 12C-2 5 7 1 12 7c5-6 14-2 9 5Z"/>',
  airborne: '<path d="M12 18V8m0 4L5 6 2 8l6 8m4-4 7-6 3 2-6 8M9 20h6"/>',
  'mighty-leap': '<path d="M4 19c0-6 3-10 8-14 5 4 8 8 8 14M8 9l4-4 4 4M8 19h8"/>',
  'touch-of-death': '<path d="M7 18v3h10v-3c3-2 4-4 4-8a9 9 0 0 0-18 0c0 4 1 6 4 8Z"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><path d="m10 16 2-3 2 3"/>',
  'many-lives': '<path d="M12 7c-6-8-15 1-9 7l9 7 9-7c6-6-3-15-9-7Z"/><path d="M7 12h10m-5-5v10"/>',
  'worthy-sacrifice': '<path d="M5 3 2 9a3 3 0 0 0 6 0L5 3Zm14 0-3 6a3 3 0 0 0 6 0l-3-6ZM12 12l-3 6a3 3 0 0 0 6 0l-3-6Z"/>',
  bifurcated: '<path d="M12 21V11L3 3m9 8 9-8M3 9V3h6m6 0h6v6"/>',
  trifurcated: '<path d="M12 22V2m-4 4 4-4 4 4M12 14 2 4m10 10L22 4M2 10V4h6m8 0h6v6"/>',
  fledgling: '<path d="M12 22V7m-4 4 4-4 4 4M12 17C4 17 3 13 3 10c5 0 9 3 9 7Zm0-3c7 0 9-4 9-7-5 0-9 3-9 7Z"/>',
  'rabbit-hole': '<path d="M7 13C1-2 8-2 10 12m4 0c2-14 9-14 3 1M6 15c0-5 12-5 12 0v2c0 6-12 6-12 0Z"/><circle cx="9" cy="16" r=".7"/><circle cx="15" cy="16" r=".7"/>',
  fecundity: '<rect x="3" y="3" width="12" height="15" rx="2"/><rect x="9" y="7" width="12" height="15" rx="2"/>',
  unkillable: '<path d="M19 7a9 9 0 1 0 2 10M19 2v6h-6"/><path d="M9 12h6m-3-3v6"/>',
  stinky: '<path d="M5 21c-4-5 4-6 0-11m7 11c-4-5 4-6 0-11m7 11c-4-5 4-6 0-11M5 5V2m7 3V2m7 3V2"/>',
});

function icon(name) {
  return `<svg class="card-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ''}</svg>`;
}

function cardInnerHtml(card) {
  const sigils = sigilsOf(card).filter(sigil => SIGILS[sigil]).map(sigil => {
    const [, name, description] = SIGILS[sigil];
    return `<span class="sigil" title="${name}: ${description}" aria-label="${name}">${icon(sigil)}</span>`;
  }).join('');
  const artwork = CARD_ART[card.key === 'wolfCub' && card.name === 'Wolf' ? 'wolf' : card.key] || '';
  const cost = card.cost.type === 'free' ? 'FREE' : `${icon(card.cost.type)}<span>${card.cost.amount}</span>`;
  return `
    <div class="card-name">${card.name}</div><div class="card-cost ${card.cost?.type || 'free'}">${cost}</div>
    <div class="portrait" aria-hidden="true">${artwork}</div><div class="sigils">${sigils}</div>
    <div class="stats"><span class="power" title="Power">${icon('power')}<b class="stat-value">${card.power}</b></span><span class="health" title="Health">${icon('health')}<b class="stat-value">${card.health}</b></span></div>`;
}

function cardHtml(card, classes = '') {
  return `<div class="card ${card.rarity === 'rare' ? 'rare' : ''} ${classes}" data-key="${card.key || ''}" title="${escapeHtml(cardDescription(card))}">${cardInnerHtml(card)}</div>`;
}

function canManeuverFrom(lane) {
  return Boolean(battle.playerLanes[lane]) && [lane - 1, lane + 1].some(target => target >= 0 && target < 4 && !battle.playerLanes[target]);
}

function canMend(card) {
  return Boolean(card) && card.health < (card.maxHealth ?? card.health);
}

function laneHtml(card, lane, side, incoming = false) {
  const selected = side === 'player' && (sacrificeLanes.includes(lane) || tacticSourceLane === lane);
  const tacticTarget = tacticMode === 'maneuver' ? (tacticSourceLane == null ? canManeuverFrom(lane) : !card && Math.abs(tacticSourceLane - lane) === 1)
    : tacticMode === 'mend' ? canMend(card) : false;
  const canTarget = side === 'player' && (tacticTarget || (selectedId && (selectionStage === 'sacrifice' ? Boolean(card) : (!card || selected))));
  const label = `${side === 'preview' ? 'Incoming' : side === 'opponent' ? 'Opponent' : 'Your'} lane ${lane + 1}: ${card ? cardDescription(card) : 'Empty.'}${selected ? ' Selected.' : ''}${canTarget ? ' Available target.' : ''}`;
  const contents = card ? cardHtml(card, incoming ? 'preview-card' : '') : '<span class="empty-slot" aria-hidden="true"></span>';
  const attributes = `class="lane ${side} ${selected ? 'sacrifice-selected' : ''} ${canTarget ? 'can-target' : ''}" data-lane="${lane}" data-number="${lane + 1}" aria-label="${escapeHtml(label)}"${card ? ` title="${escapeHtml(cardDescription(card))}"` : ''}`;
  return side === 'player'
    ? `<button ${attributes} aria-pressed="${selected}"${busy ? ' disabled' : ''}>${contents}</button>`
    : card ? `<button ${attributes} type="button">${contents}</button>` : `<div ${attributes} role="img">${contents}</div>`;
}

function renderScale(value) {
  const clamped = Math.max(-MATCH_RULES.dominationMargin, Math.min(MATCH_RULES.dominationMargin, value));
  ui.scaleBeam.style.setProperty('--tilt', `${(clamped / MATCH_RULES.dominationMargin) * 14}deg`);
  ui.playerWeights.innerHTML = clamped > 0 ? '<i></i>'.repeat(Math.min(10, clamped)) : '';
  ui.enemyWeights.innerHTML = clamped < 0 ? '<i></i>'.repeat(Math.min(10, -clamped)) : '';
  ui.scaleReadout.textContent = value === 0 ? 'The balance is even' : `${value > 0 ? 'You lead' : 'They lead'} by ${Math.abs(value)}`;
  ui.scaleReadout.dataset.leader = value > 0 ? 'player' : value < 0 ? 'opponent' : 'even';
}

function renderBattle() {
  const activeElement = document.activeElement;
  const focusedCardId = activeElement?.closest('.hand-card')?.dataset.id;
  const focusedLaneControl = activeElement?.closest('.lane');
  const focusedLane = focusedLaneControl?.dataset.lane;
  const focusedSide = ['player', 'opponent', 'preview'].find(side => focusedLaneControl?.classList.contains(side));
  const tutorialCard = tutorial.active && tutorial.current()?.action === 'select-card' ? battle.hand.find(card => card.key === tutorial.current().target) : null;
  if (tutorialCard) ensureHandCardVisible(tutorialCard.id);
  else if (selectedId) ensureHandCardVisible(selectedId);
  const pageCount = Math.max(1, Math.ceil(battle.hand.length / handLimit()));
  handPage = Math.max(0, Math.min(handPage, pageCount - 1));
  const firstCard = handPage * handLimit();
  const visibleHand = battle.hand.slice(firstCard, firstCard + handLimit());
  const encounter = ENCOUNTERS[run.encounter];
  ui.trialLabel.textContent = `TRIAL ${['I','II','III'][run.encounter]} OF III`;
  ui.opponentName.textContent = encounter.name; ui.opponentSubtitle.textContent = encounter.subtitle;
  const previewByLane = Array(4).fill(null); preview.forEach(entry => { previewByLane[entry.lane] ||= entry.card; });
  ui.previewRow.innerHTML = previewByLane.map((card, lane) => laneHtml(card, lane, 'preview', true)).join('');
  ui.opponentRow.innerHTML = battle.opponentLanes.map((card, lane) => laneHtml(card, lane, 'opponent')).join('');
  ui.playerRow.innerHTML = battle.playerLanes.map((card, lane) => laneHtml(card, lane, 'player')).join('');
  ui.playerRow.querySelectorAll('.lane').forEach(button => button.addEventListener('click', () => laneClick(Number(button.dataset.lane))));
  ui.hand.innerHTML = visibleHand.map((card, index) => {
    const position = visibleHand.length > 1 ? (index / (visibleHand.length - 1)) * 2 - 1 : 0;
    return `<button class="hand-card card ${selectedId === card.id ? 'selected' : ''} ${card.rarity === 'rare' ? 'rare' : ''}" style="--fan-index:${index};--fan-angle:${position * (compactHand.matches ? 8 : 11)}deg;--fan-rise:${-(1 - Math.abs(position)) * (compactHand.matches ? 11 : 18)}px" data-id="${card.id}" data-key="${card.key}" aria-label="${escapeHtml(cardDescription(card))}" title="${escapeHtml(cardDescription(card))}" aria-pressed="${selectedId === card.id}"${busy || !battle.hasDrawn ? ' disabled' : ''}>${cardInnerHtml(card)}</button>`;
  }).join('');
  ui.hand.style.setProperty('--hand-count', visibleHand.length);
  ui.hand.dataset.page = handPage; ui.hand.dataset.pages = pageCount;
  ui.handPageReadout.textContent = battle.hand.length ? `${firstCard + 1}–${firstCard + visibleHand.length} / ${battle.hand.length}` : 'Empty hand';
  ui.handPrevious.disabled = busy || tutorial.active || handPage === 0;
  ui.handNext.disabled = busy || tutorial.active || handPage >= pageCount - 1;
  ui.handPrevious.hidden = ui.handNext.hidden = ui.handPageReadout.hidden = pageCount <= 1;
  ui.hand.querySelectorAll('.hand-card').forEach(button => button.addEventListener('click', () => selectCard(button.dataset.id)));
  ui.mainCount.textContent = battle.deck.length; ui.sideCount.textContent = battle.sideDeck.length;
  ui.mainDeck.title = battle.deck.length ? `Scout up to 3 creatures and choose 1. ${battle.deck.length} cards remain.` : 'Creature deck empty';
  ui.mainDeck.disabled = busy || battle.hasDrawn || !battle.deck.length; ui.sideDeck.disabled = busy || battle.hasDrawn || !battle.sideDeck.length;
  ui.bellButton.disabled = busy || !battle.hasDrawn;
  ui.maneuverButton.disabled = busy || battle.tacticUsed || tutorial.active || !battle.playerLanes.some((card, lane) => canManeuverFrom(lane));
  ui.mendButton.disabled = busy || battle.tacticUsed || tutorial.active || battle.bones < 2 || !battle.playerLanes.some(canMend);
  ui.maneuverButton.classList.toggle('active', tacticMode === 'maneuver');
  ui.mendButton.classList.toggle('active', tacticMode === 'mend');
  ui.maneuverButton.setAttribute('aria-pressed', String(tacticMode === 'maneuver'));
  ui.mendButton.setAttribute('aria-pressed', String(tacticMode === 'mend'));
  ui.maneuverButton.title = battle.tacticUsed ? 'Your tactic has been used this turn.' : 'Move one creature into an adjacent empty lane. One tactic per turn.';
  ui.mendButton.title = battle.tacticUsed ? 'Your tactic has been used this turn.' : 'Spend 2 Bones to restore up to 2 Health to a wounded creature. One tactic per turn.';
  ui.bonesReadout.textContent = battle.bones;
  ui.bonePile.innerHTML = Array.from({ length: Math.min(10, battle.bones) }, (_, index) => `<i class="bone-token" style="--r:${-26 + (index * 17) % 55}deg;--x:${(index % 4) * 9}px;--y:${Math.floor(index / 4) * -7}px"></i>`).join('');
  ui.turnReadout.textContent = battle.turn <= MATCH_RULES.regulationTurns ? `Turn ${battle.turn} / ${MATCH_RULES.regulationTurns}` : `Sudden death · ${battle.turn}`;
  ui.phaseReadout.textContent = busy ? 'Combat resolving' : tacticMode === 'maneuver' ? 'Maneuver a creature' : tacticMode === 'mend' ? 'Mend a creature' : battle.hasDrawn ? 'Play cards or ring' : 'Choose one draw';
  const incomingPower = previewByLane.reduce((sum, card) => sum + (card?.power || 0), 0);
  ui.enemyPower.textContent = preview.length ? `${incomingPower} Power approaching` : 'No arrivals this turn';
  renderScale(battle.scale);
  ui.instruction.textContent = instructionText();
  const card = selectedCard();
  ui.actionTray.hidden = !card && !tacticMode; ui.offerButton.hidden = !(card && selectionStage === 'sacrifice' && offeredBlood() >= card.cost.amount);
  ui.selectionSummary.textContent = card ? selectionText(card) : tacticMode === 'maneuver' ? 'Maneuver · move to an adjacent empty lane' : tacticMode === 'mend' ? 'Mend · 2 Bones to restore up to 2 Health' : '';
  ui.cancelButton.textContent = tacticMode ? 'Cancel tactic' : 'Put card back';
  ui.inspectButton.hidden = !card;
  ui.inspectButton.disabled = busy || tutorial.active;
  ui.tableScreen.classList.toggle('busy', busy);
  if (focusedCardId) {
    focusHandCard(focusedCardId);
  } else if (focusedLane !== undefined) {
    focusWithoutInspection(document.querySelector(`.lane.${focusedSide}[data-lane="${focusedLane}"]`));
  }
}

function changeHandPage(delta) {
  if (busy || tutorial.active || scene !== 'battle') return;
  closeInspector();
  selectedId = null; sacrificeLanes = []; selectionStage = null; tacticMode = null; tacticSourceLane = null;
  handPage += delta;
  render();
  focusBattleAction();
}

function renderTutorial() {
  document.querySelectorAll('.tutorial-focus').forEach(element => element.classList.remove('tutorial-focus'));
  const visible = tutorial.active && scene === 'battle';
  ui.tutorialOverlay.hidden = !visible;
  document.body.classList.toggle('tutorial-running', visible);
  ui.cancelButton.disabled = tutorial.active;
  if (!visible) return;
  const step = tutorial.current();
  ui.tutorialProgress.textContent = `Guided hand · ${tutorial.index + 1} of ${TUTORIAL_STEPS.length}`;
  ui.tutorialTitle.textContent = step.title;
  ui.tutorialCopy.textContent = step.copy;
  ui.tutorialContinue.hidden = step.action !== 'continue';
  requestAnimationFrame(() => document.querySelector(step.spotlight)?.classList.add('tutorial-focus'));
}

function cardForControl(control) {
  if (!control) return null;
  if (control.classList.contains('hand-card')) return battle?.hand.find(card => card.id === control.dataset.id);
  if (control.classList.contains('lane')) {
    const lane = Number(control.dataset.lane);
    return control.classList.contains('player') ? battle?.playerLanes[lane]
      : control.classList.contains('opponent') ? battle?.opponentLanes[lane]
      : preview.find(entry => entry.lane === lane)?.card;
  }
  if (control.dataset.id) return scoutOptions.find(card => card.id === control.dataset.id);
  const template = CARD_LIBRARY[control.dataset.key];
  if (template) return { ...template, key: control.dataset.key, maxHealth: template.health };
  return null;
}

function inspectorFocusOrigin() {
  if (inspectorOrigin?.isConnected) return inspectorOrigin;
  if (inspectorOrigin?.classList.contains('hand-card')) return [...ui.hand.querySelectorAll('.hand-card')].find(card => card.dataset.id === inspectorOrigin.dataset.id);
  if (inspectorOrigin?.classList.contains('lane')) {
    const side = ['player', 'opponent', 'preview'].find(value => inspectorOrigin.classList.contains(value));
    return document.querySelector(`.lane.${side}[data-lane="${inspectorOrigin.dataset.lane}"]`);
  }
  return null;
}

function closeInspector(restoreFocus = false) {
  clearTimeout(inspectorHideTimer);
  if (!ui.cardInspector) return;
  if (!ui.cardInspector.hidden || restoreFocus) {
    suppressPassiveHover = true;
    dismissedPointerPosition = lastPointerPosition;
  }
  const origin = restoreFocus ? inspectorFocusOrigin() : null;
  ui.cardInspector.hidden = true; inspectorPinned = false;
  if (ui.cardInspector.parentElement !== inspectorHome) inspectorHome.append(ui.cardInspector);
  inspectorOrigin = null;
  if (origin && !origin.disabled) focusWithoutInspection(origin);
}

function showInspector(card, origin, pinned = false) {
  if (!card || busy || tutorial.active || suppressInspection || (inspectorPinned && !pinned)) return;
  clearTimeout(inspectorHideTimer);
  const activeDialog = origin?.closest('dialog[open]');
  if (activeDialog) activeDialog.append(ui.cardInspector);
  else if (document.querySelector('dialog[open]')) return;
  else if (ui.cardInspector.parentElement !== inspectorHome) inspectorHome.append(ui.cardInspector);
  inspectorOrigin = origin; inspectorPinned = pinned;
  ui.inspectorCard.innerHTML = cardHtml(card, 'inspected-card');
  const cost = card.cost.type === 'free' ? 'Free' : `${card.cost.amount} ${card.cost.type === 'blood' ? 'Blood' : 'Bones'}`;
  const sigils = sigilsOf(card).filter(sigil => SIGILS[sigil]);
  ui.inspectorDetails.innerHTML = `<h2>${escapeHtml(card.name)}</h2><dl class="inspection-stats"><div><dt>Cost</dt><dd>${cost}</dd></div><div><dt>Power</dt><dd>${card.power}</dd></div><div><dt>Health</dt><dd>${card.health} / ${card.maxHealth ?? card.health}</dd></div></dl>${sigils.length ? `<ul class="inspection-sigils">${sigils.map(sigil => `<li>${icon(sigil)}<div><strong>${SIGILS[sigil][1]}</strong><p>${SIGILS[sigil][2]}</p></div></li>`).join('')}</ul>` : '<p class="inspection-plain">No sigils.</p>'}`;
  ui.cardInspector.hidden = false;
  ui.cardInspector.dataset.pinned = String(pinned);
  if (pinned) focusWithoutInspection(ui.inspectorClose);
}

function openDialog(dialog, returnTarget) {
  closeInspector();
  for (const open of document.querySelectorAll('dialog[open]')) if (open !== dialog) open.close();
  dialogReturnFocus.set(dialog, returnTarget);
  if (!dialog.open) dialog.showModal();
}

function renderDeckCollection() {
  const counts = new Map();
  for (const key of run?.deck || STARTER_DECK) counts.set(key, (counts.get(key) || 0) + 1);
  ui.deckChoices.innerHTML = `<p class="deck-summary">${run?.deck.length || STARTER_DECK.length} cards · ${counts.size} creatures</p><div class="deck-grid">${[...counts].map(([key, count]) => {
    const card = createCard(key);
    return `<button class="deck-card" data-key="${key}" aria-label="Inspect ${escapeHtml(cardDescription(card))} ${count} in your deck.">${cardHtml(card)}<span class="deck-count">×${count}</span></button>`;
  }).join('')}</div>`;
}

function renderAudioControls() {
  const state = audio.snapshot();
  const musicPercent = Math.round(state.musicVolume * 100);
  const sfxPercent = Math.round(state.sfxVolume * 100);
  ui.musicVolume.value = musicPercent; ui.musicValue.textContent = `${musicPercent}%`;
  ui.sfxVolume.value = sfxPercent; ui.sfxValue.textContent = `${sfxPercent}%`;
  ui.muteButton.textContent = state.muted ? 'Restore all audio' : 'Mute all audio';
  ui.audioIcon.textContent = state.muted ? '×' : '♪';
  ui.audioButton.classList.toggle('muted', state.muted);
  ui.audioButton.classList.toggle('playing', state.musicPlaying && !state.muted);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function renderTurnLog() {
  const turns = ledger.snapshot();
  const entryCount = turns.reduce((total, turn) => total + turn.phases.reduce((phaseTotal, phase) => phaseTotal + phase.entries.length, 0), 0);
  ui.turnLog.innerHTML = turns.map((turn, turnIndex) => `<article class="log-turn ${turnIndex === turns.length - 1 ? 'current' : ''}">
    <h3>Turn ${turn.turn}</h3>
    ${turn.phases.filter(phase => phase.entries.length).map(phase => `<section class="log-phase ${phase.side}"><h4>${phase.side === 'player' ? 'Your phase' : 'Opponent phase'}</h4><ul>${phase.entries.map(entry => `<li class="log-entry ${entry.kind}" data-event="${entry.type}">${escapeHtml(entry.text)}</li>`).join('')}</ul></section>`).join('')}
  </article>`).join('');
  if (entryCount !== renderedLogEntries) {
    ui.turnLog.scrollTop = ui.turnLog.scrollHeight;
    requestAnimationFrame(() => { ui.turnLog.scrollTop = ui.turnLog.scrollHeight; });
  }
  renderedLogEntries = entryCount;
}

function instructionText() {
  const card = selectedCard();
  if (busy) return 'Your creatures attack first. The opponent replies next.';
  if (tacticMode === 'maneuver') return tacticSourceLane == null ? 'Choose a highlighted creature to move.' : 'Choose an adjacent highlighted empty lane.';
  if (tacticMode === 'mend') return 'Choose a highlighted wounded creature to heal.';
  if (!battle.hasDrawn) return 'Choose a pile to draw.';
  if (!card) return 'Select a card, or ring the bell.';
  if (selectionStage === 'sacrifice') return `Mark creatures worth ${card.cost.amount} blood.`;
  return 'Choose a highlighted destination lane.';
}
function selectionText(card) {
  if (selectionStage === 'sacrifice') return `${card.name} needs ${card.cost.amount} blood · ${offeredBlood()} offered`;
  return `${card.name} is paid for · choose its lane`;
}

function renderRewards() {
  ui.rewardChoices.innerHTML = rewardKeys.map(key => {
    const card = createCard(key);
    return `<button class="reward-card" data-key="${key}" aria-label="Choose ${escapeHtml(cardDescription(card))}">${cardHtml(card)}</button>`;
  }).join('');
  ui.rewardChoices.querySelectorAll('button').forEach(button => button.addEventListener('click', () => takeReward(button.dataset.key)));
}

function renderScoutChoices() {
  ui.scoutChoices.innerHTML = scoutOptions.map(card => `<button class="reward-card" data-id="${card.id}" aria-label="Draw ${escapeHtml(cardDescription(card))}">${cardHtml(card)}</button>`).join('');
  ui.scoutChoices.querySelectorAll('button').forEach(button => button.addEventListener('click', () => chooseScout(button.dataset.id)));
}

function renderResult() {
  const won = scene === 'victory';
  const retrying = scene === 'retry';
  ui.resultEyebrow.textContent = won ? 'THREE TRIALS SURVIVED' : retrying ? 'YOUR BONES BREAK · NOT YOUR WILL' : 'THE SCALE CLAIMS ITS DUE';
  ui.resultTitle.textContent = won ? 'THE TABLE YIELDS' : retrying ? 'RISE WITH BROKEN BONES' : 'YOUR CANDLE GOES DARK';
  ui.resultCopy.textContent = won ? `Your ${run.deck.length}-card deck mastered blood, bones, lanes, and sigils.` : retrying ? 'Repeat this trial with 2 emergency Bones added to your Marrow Reserve. This mercy is offered only once per run.' : 'Rebuild your opening deck and read the incoming row more carefully.';
  ui.restartButton.textContent = retrying ? 'RETRY THIS TRIAL' : 'DEAL AGAIN';
}

function render() {
  const sceneChanged = renderedScene !== scene;
  if (sceneChanged || busy) closeInspector();
  if (sceneChanged) for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  ui.titleScreen.hidden = scene !== 'title'; ui.tableScreen.hidden = scene !== 'battle'; ui.rewardScreen.hidden = scene !== 'reward';
  ui.resultScreen.hidden = !['victory', 'retry', 'defeat'].includes(scene);
  if (scene === 'battle') { renderBattle(); renderTurnLog(); } if (scene === 'reward') renderRewards(); if (['victory', 'retry', 'defeat'].includes(scene)) renderResult();
  renderTutorial(); renderAudioControls();
  ui.deckViewButton.disabled = !run;
  ui.ledgerButton.disabled = !ledger.snapshot().length;
  if (sceneChanged) {
    const focusTarget = scene === 'reward' ? ui.rewardChoices.querySelector('button')
      : ['victory', 'retry', 'defeat'].includes(scene) ? ui.restartButton
      : scene === 'battle' ? tutorial.active ? ui.tutorialContinue : ui.hand.querySelector('button')
      : ui.startButton;
    focusWithoutInspection(focusTarget);
  }
  renderedScene = scene;
}

ui.startButton.addEventListener('click', () => startRun(tutorial.shouldAutoStart()));
ui.tutorialButton.addEventListener('click', () => { tutorial.replay(); startRun(); });
ui.restartButton.addEventListener('click', () => { if (scene === 'retry') { run = retryBattle(run); startBattle(); } else startRun(); });
ui.mainDeck.addEventListener('click', () => draw('main')); ui.sideDeck.addEventListener('click', () => draw('side'));
ui.maneuverButton.addEventListener('click', () => chooseTactic('maneuver')); ui.mendButton.addEventListener('click', () => chooseTactic('mend'));
ui.scoutDialog.addEventListener('cancel', event => event.preventDefault());
ui.bellButton.addEventListener('click', ringBell); ui.offerButton.addEventListener('click', lockOffering); ui.cancelButton.addEventListener('click', clearSelection);
ui.menuButton.addEventListener('click', () => { audio.playCue('ui'); openDialog(ui.pauseDialog, ui.menuButton); });
ui.resumeButton.addEventListener('click', () => ui.pauseDialog.close());
for (const button of [ui.rulesButton, ui.titleRulesButton]) button.addEventListener('click', () => { audio.playCue('ui'); openDialog(ui.rulesDialog, button === ui.titleRulesButton ? button : ui.menuButton); });
for (const button of [ui.audioButton, ui.titleAudioButton]) button.addEventListener('click', () => { audio.playCue('ui'); renderAudioControls(); openDialog(ui.audioDialog, button === ui.titleAudioButton ? button : ui.menuButton); });
ui.ledgerButton.addEventListener('click', () => {
  audio.playCue('ui'); openDialog(ui.ledgerDialog, ui.ledgerButton); renderTurnLog();
  requestAnimationFrame(() => { ui.turnLog.scrollTop = ui.turnLog.scrollHeight; });
});
ui.deckViewButton.addEventListener('click', () => { audio.playCue('ui'); renderDeckCollection(); openDialog(ui.deckDialog, ui.deckViewButton); });
for (const dialog of [ui.pauseDialog, ui.rulesDialog, ui.audioDialog, ui.ledgerDialog, ui.deckDialog]) dialog.addEventListener('close', () => {
  if (document.querySelector('dialog[open]')) return;
  closeInspector();
  const returnTarget = dialogReturnFocus.get(dialog);
  if (returnTarget?.closest('dialog')?.open === false) focusWithoutInspection(ui.menuButton);
  else if (returnTarget?.getClientRects().length) focusWithoutInspection(returnTarget);
});
ui.fullscreenButton.addEventListener('click', async () => {
  closeInspector(); ui.pauseDialog.close();
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { showToast('FULL SCREEN IS NOT AVAILABLE IN THIS BROWSER'); }
});
document.addEventListener('fullscreenchange', () => {
  ui.fullscreenButton.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen';
});
ui.handPrevious.addEventListener('click', () => changeHandPage(-1));
ui.handNext.addEventListener('click', () => changeHandPage(1));
ui.inspectButton.addEventListener('click', () => showInspector(selectedCard(), ui.inspectButton, true));
ui.inspectorClose.addEventListener('click', () => closeInspector(true));

const inspectionControl = target => target?.closest('.hand-card, .lane, .deck-card');
for (const container of [ui.hand, ui.playerRow, ui.opponentRow, ui.previewRow, ui.deckChoices]) {
  container.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || suppressPassiveHover) return;
    const control = inspectionControl(event.target);
    if (!control || control.contains(event.relatedTarget)) return;
    showInspector(cardForControl(control), control);
  });
  container.addEventListener('pointerout', event => {
    const control = inspectionControl(event.target);
    if (!control || control.contains(event.relatedTarget) || ui.cardInspector.contains(event.relatedTarget) || inspectorPinned || document.activeElement === control) return;
    clearTimeout(inspectorHideTimer); inspectorHideTimer = setTimeout(() => closeInspector(), 160);
  });
  container.addEventListener('focusin', event => {
    if (suppressInspection || lastInteraction === 'touch') return;
    suppressPassiveHover = false;
    const control = inspectionControl(event.target);
    const card = cardForControl(control);
    if (card) showInspector(card, control);
    else if (!inspectorPinned) closeInspector();
  });
  container.addEventListener('focusout', event => {
    const control = inspectionControl(event.target);
    if (!control) return;
    queueMicrotask(() => {
      if (!inspectorPinned && inspectorOrigin === control && !ui.cardInspector.contains(document.activeElement) && !control.contains(document.activeElement) && (lastInteraction === 'keyboard' || !control.matches(':hover'))) closeInspector();
    });
  });
  container.addEventListener('click', event => {
    const control = inspectionControl(event.target);
    if (control?.classList.contains('deck-card') || control?.classList.contains('opponent') || control?.classList.contains('preview')) showInspector(cardForControl(control), control, true);
  });
}
ui.cardInspector.addEventListener('pointerenter', () => clearTimeout(inspectorHideTimer));
ui.cardInspector.addEventListener('pointerleave', () => {
  if (!inspectorPinned && !ui.cardInspector.contains(document.activeElement)) inspectorHideTimer = setTimeout(() => closeInspector(), 160);
});
ui.cardInspector.addEventListener('focusout', () => {
  queueMicrotask(() => {
    if (!inspectorPinned && !ui.cardInspector.contains(document.activeElement) && !inspectionControl(document.activeElement)) closeInspector();
  });
});
document.addEventListener('pointerdown', event => {
  lastInteraction = event.pointerType === 'touch' ? 'touch' : 'pointer';
  lastPointerPosition = { x: event.clientX, y: event.clientY };
}, true);
document.addEventListener('pointermove', event => {
  lastPointerPosition = { x: event.clientX, y: event.clientY };
  if (!suppressPassiveHover || event.pointerType === 'touch') return;
  if (dismissedPointerPosition && Math.hypot(event.clientX - dismissedPointerPosition.x, event.clientY - dismissedPointerPosition.y) <= 3) return;
  suppressPassiveHover = false;
  const control = inspectionControl(event.target);
  if (control) showInspector(cardForControl(control), control);
});
ui.muteButton.addEventListener('click', () => { audio.toggleMute(); renderAudioControls(); });
ui.musicVolume.addEventListener('input', event => { audio.setMusicVolume(Number(event.target.value) / 100); renderAudioControls(); });
ui.sfxVolume.addEventListener('input', event => { audio.setSfxVolume(Number(event.target.value) / 100); audio.playCue('ui'); renderAudioControls(); });
ui.ledgerToggle.addEventListener('click', () => {
  const collapsed = ui.ledgerPanel.classList.toggle('collapsed');
  ui.ledgerToggle.textContent = collapsed ? 'Expand' : 'Collapse';
  ui.ledgerToggle.setAttribute('aria-expanded', String(!collapsed));
});
ui.replayTutorial.addEventListener('click', () => { ui.rulesDialog.close(); tutorial.replay(); startRun(); });
ui.tutorialContinue.addEventListener('click', () => {
  if (!tutorialAllows('continue')) return;
  const finalStep = tutorial.current()?.id === 'complete';
  advanceTutorial('continue');
  render();
  if (finalStep) showToast('GUIDED HAND COMPLETE · THE TABLE IS YOURS');
});
ui.tutorialSkip.addEventListener('click', () => { tutorial.skip(); render(); showToast('TUTORIAL SKIPPED · REPLAY IT FROM THE RULEBOOK'); });
document.addEventListener('keydown', event => {
  lastInteraction = 'keyboard';
  if (event.key !== 'Escape') suppressPassiveHover = false;
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (!ui.cardInspector.hidden) { event.preventDefault(); closeInspector(true); return; }
  const dialog = document.querySelector('dialog[open]');
  if (dialog) { if (dialog !== ui.scoutDialog) { event.preventDefault(); dialog.close(); } return; }
  if (scene !== 'battle' || busy || tutorial.active) return;
  if (selectedId || tacticMode) { event.preventDefault(); clearSelection(); }
});
ui.sigilGlossary.innerHTML = Object.values(SIGILS).map(([, name, description]) => `<p><b>${name}</b><br>${description}</p>`).join('');
let handResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(handResizeTimer);
  handResizeTimer = setTimeout(() => {
    if (scene !== 'battle') return;
    closeInspector(true);
    const focusedCardId = document.activeElement?.closest('.hand-card')?.dataset.id;
    if (focusedCardId) ensureHandCardVisible(focusedCardId);
    render();
  }, 120);
});

if (new URLSearchParams(location.search).has('debug')) {
  window.__BLOOD_BONE__ = {
    snapshot: () => ({ scene, encounter: run?.encounter ?? null, turn: battle?.turn ?? null, handCount: battle?.hand.length ?? 0, playerCards: battle?.playerLanes.filter(Boolean).map(card => card.key) || [], opponentCards: battle?.opponentLanes.filter(Boolean).map(card => card.key) || [], bones: battle?.bones ?? 0, scale: battle?.scale ?? 0, tacticUsed: battle?.tacticUsed ?? false, tutorial: tutorial.current()?.id || null, audio: audio.snapshot(), turnLog: ledger.snapshot(), preview: preview.map(entry => ({ lane: entry.lane, key: entry.card.key })) }),
    winBattle: () => { if (scene === 'battle') finishBattle(true); },
    loseBattle: () => { if (scene === 'battle') finishBattle(false); },
  };
}

render();
