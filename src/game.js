import { CARD_LIBRARY, STARTER_DECK, createCard } from './cards.js';
import { createBattle, drawCard, playCard, resolveCombat, ageCards, beginPlayerTurn, maneuverCreature, mendCreature, scoutDeck, chooseScoutedCard } from './core.js';
import { createRun, completeBattle, chooseReward, retryBattle, ENCOUNTERS, startingBonesForEncounter, startingBonesForRun } from './run.js';
import { previewForTurn, deployPreview } from './encounters.js';
import { CARD_ART } from './illustrations.js';
import { TutorialController, TUTORIAL_STEPS } from './tutorial.js';
import { AudioDirector } from './audio.js';
import { TurnLedger } from './turn-log.js';
import { COMBAT_PACING, pacingForEvent } from './combat-pacing.js';
import { MATCH_RULES, judgeMatch } from './match-rules.js';

const ui = Object.fromEntries([
  'titleScreen','tableScreen','rewardScreen','resultScreen','startButton','tutorialButton','restartButton','trialLabel','opponentName','opponentSubtitle','scaleBeam','scaleReadout','enemyWeights','playerWeights','boneReserve','bonePile','bonesReadout','turnReadout','phaseReadout','previewRow','opponentRow','playerRow','enemyPower','mainDeck','sideDeck','mainCount','sideCount','hand','instruction','bellButton','maneuverButton','mendButton','actionTray','selectionSummary','offerButton','cancelButton','rewardChoices','scoutDialog','scoutChoices','rulesButton','rulesDialog','sigilGlossary','replayTutorial','audioButton','audioIcon','audioDialog','muteButton','musicVolume','musicValue','sfxVolume','sfxValue','ledgerPanel','ledgerToggle','turnLog','tutorialOverlay','tutorialProgress','tutorialTitle','tutorialCopy','tutorialContinue','tutorialSkip','resultEyebrow','resultTitle','resultCopy','toast','board',
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
  ledger.add({ type: 'battle-start', encounterName: ENCOUNTERS[run.encounter].name, handNames: hand.map(card => card.name) });
  ledger.add({ type: 'bones', reason: 'The Marrow Reserve', amount: marrowBones, total: marrowBones });
  if (run.losses) ledger.add({ type: 'bones', reason: 'Broken Bones', amount: 2, total: startingBones, pluralSource: true });
  ledger.add({ type: 'preview', cardNames: preview.map(entry => `${entry.card.name} in lane ${entry.lane + 1}`) });
  selectedId = null; sacrificeLanes = []; selectionStage = null; tacticMode = null; tacticSourceLane = null; scoutOptions = []; busy = false;
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
  advanceTutorial('draw', source); audio.playCue('draw'); render();
}

function chooseScout(cardId) {
  const result = chooseScoutedCard(battle, cardId);
  if (!result.ok) { showToast('THAT CREATURE IS NO LONGER AVAILABLE'); audio.playCue('invalid'); return; }
  const chosen = result.state.hand.at(-1);
  battle = result.state;
  ledger.add({ type: 'scout', cardNames: scoutOptions.map(card => card.name), chosenName: chosen.name });
  advanceTutorial('draw', 'main');
  scoutOptions = [];
  ui.scoutDialog.close();
  audio.playCue('draw'); render();
}

function selectCard(cardId) {
  if (busy || !battle.hasDrawn) { showToast('CHOOSE A DRAW PILE FIRST'); return; }
  const card = battle.hand.find(item => item.id === cardId); if (!card) return;
  if (!tutorialAllows('select-card', card.key)) return;
  if (selectedId === cardId) { clearSelection(); return; }
  selectedId = cardId; sacrificeLanes = []; tacticMode = null; tacticSourceLane = null;
  selectionStage = card.cost.type === 'blood' && card.cost.amount > 0 ? 'sacrifice' : 'place';
  advanceTutorial('select-card', card.key); audio.playCue('select'); render();
}

function clearSelection() { selectedId = null; sacrificeLanes = []; selectionStage = null; tacticMode = null; tacticSourceLane = null; render(); }

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
  advanceTutorial('lock-offer');
  selectionStage = 'place'; audio.playCue('ui'); render();
}

function logMaturation(beforeLanes, afterLanes, side) {
  beforeLanes.forEach((before, lane) => {
    const after = afterLanes[lane];
    if (before?.sigils?.includes('fledgling') && after && !after.sigils?.includes('fledgling')) {
      ledger.add({ type: 'mature', beforeName: before.name, afterName: after.name, lane, side });
    }
  });
}

async function ringBell() {
  if (busy || !battle.hasDrawn) { showToast('DRAW BEFORE ENDING THE TURN'); return; }
  if (!tutorialAllows('ring-bell')) return;
  advanceTutorial('ring-bell');
  busy = true; selectedId = null; sacrificeLanes = []; selectionStage = null; render();
  ui.bellButton.classList.add('ringing'); setTimeout(() => ui.bellButton.classList.remove('ringing'), 760);
  audio.playCue('bell');
  ledger.add({ type: 'combat-start', side: 'player' }); renderTurnLog();
  await pacingWait(COMBAT_PACING.phaseLead);
  let result = resolveCombat(battle, 'player');
  await animateEvents(result.events, 'player');
  battle = result.state; render(); await pacingWait(COMBAT_PACING.scoreSettle);
  ledger.beginPhase('opponent');
  const opponentBeforeAge = battle.opponentLanes;
  battle = ageCards(battle, 'opponent'); logMaturation(opponentBeforeAge, battle.opponentLanes, 'opponent');
  const deployed = deployPreview(battle, preview); battle = deployed.state; render();
  preview.forEach(entry => ledger.add({ type: deployed.blocked.includes(entry.lane) ? 'blocked-deploy' : 'deploy', cardName: entry.card.name, lane: entry.lane }));
  const entering = preview.find(entry => !deployed.blocked.includes(entry.lane));
  if (entering) { audio.playCue('place', .7); setTimeout(() => audio.playCreature(entering.card.key), 80); }
  if (deployed.blocked.length) showToast('AN INCOMING CREATURE WAITS BEHIND AN OCCUPIED LANE');
  await pacingWait(COMBAT_PACING.deployment);
  ledger.add({ type: 'combat-start', side: 'opponent' }); renderTurnLog();
  await pacingWait(COMBAT_PACING.phaseLead);
  result = resolveCombat(battle, 'opponent');
  await animateEvents(result.events, 'opponent');
  battle = result.state; render(); await pacingWait(COMBAT_PACING.scoreSettle);
  const outcome = judgeMatch(battle);
  if (outcome) { finishBattle(outcome.winner === 'player'); return; }
  const playerBeforeAge = battle.playerLanes;
  const aged = ageCards(battle, 'player');
  battle = beginPlayerTurn(aged); ledger.beginTurn(battle.turn); logMaturation(playerBeforeAge, battle.playerLanes, 'player');
  preview = previewForTurn(run.encounter, battle.turn);
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
      const health = lane?.querySelector('.health');
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
  run = chooseReward(run, key); audio.playCue('reward'); audio.playCreature(key); startBattle();
}

function costText(card) {
  if (card.cost.type === 'free') return 'FREE';
  if (card.cost.type === 'bones') return `♢${card.cost.amount}`;
  return '●'.repeat(card.cost.amount);
}

function cardInnerHtml(card) {
  const sigils = sigilsOf(card).filter(sigil => SIGILS[sigil]).map(sigil => {
    const [mark, name, description] = SIGILS[sigil];
    return `<span class="sigil" title="${name}: ${description}">${mark}</span>`;
  }).join('');
  const artwork = CARD_ART[card.key] || '';
  return `
    <div class="card-name">${card.name}</div><div class="card-cost ${card.cost?.type || 'free'}">${costText(card)}</div>
    <div class="portrait">${artwork}</div><div class="sigils">${sigils}</div>
    <div class="stats"><span class="power" title="Power">${card.power}</span><span class="health" title="Health">${card.health}</span></div>`;
}

function cardHtml(card, classes = '') {
  return `<div class="card ${card.rarity === 'rare' ? 'rare' : ''} ${classes}" data-key="${card.key || ''}">${cardInnerHtml(card)}</div>`;
}

function laneHtml(card, lane, side, incoming = false) {
  const selected = side === 'player' && (sacrificeLanes.includes(lane) || tacticSourceLane === lane);
  const tacticTarget = tacticMode === 'maneuver' ? (tacticSourceLane == null ? Boolean(card) : !card && Math.abs(tacticSourceLane - lane) === 1)
    : tacticMode === 'mend' ? Boolean(card) : false;
  const canTarget = side === 'player' && (tacticTarget || (selectedId && (selectionStage === 'sacrifice' ? Boolean(card) : (!card || selected))));
  return `<button class="lane ${side} ${selected ? 'sacrifice-selected' : ''} ${canTarget ? 'can-target' : ''}" data-lane="${lane}" aria-label="${side} lane ${lane + 1}">${card ? cardHtml(card, incoming ? 'preview-card' : '') : '<span class="empty-slot"></span>'}</button>`;
}

function renderScale(value) {
  const clamped = Math.max(-MATCH_RULES.dominationMargin, Math.min(MATCH_RULES.dominationMargin, value));
  ui.scaleBeam.style.setProperty('--tilt', `${(clamped / MATCH_RULES.dominationMargin) * 14}deg`);
  ui.playerWeights.innerHTML = clamped > 0 ? '<i></i>'.repeat(Math.min(10, clamped)) : '';
  ui.enemyWeights.innerHTML = clamped < 0 ? '<i></i>'.repeat(Math.min(10, -clamped)) : '';
  ui.scaleReadout.textContent = value === 0 ? 'The balance is even' : `${value > 0 ? 'You lead' : 'They lead'} by ${Math.abs(value)}`;
}

function renderBattle() {
  const encounter = ENCOUNTERS[run.encounter];
  ui.trialLabel.textContent = `TRIAL ${['I','II','III'][run.encounter]} OF III`;
  ui.opponentName.textContent = encounter.name; ui.opponentSubtitle.textContent = encounter.subtitle;
  const previewByLane = Array(4).fill(null); preview.forEach(entry => { previewByLane[entry.lane] ||= entry.card; });
  ui.previewRow.innerHTML = previewByLane.map((card, lane) => laneHtml(card, lane, 'preview', true)).join('');
  ui.opponentRow.innerHTML = battle.opponentLanes.map((card, lane) => laneHtml(card, lane, 'opponent')).join('');
  ui.playerRow.innerHTML = battle.playerLanes.map((card, lane) => laneHtml(card, lane, 'player')).join('');
  ui.playerRow.querySelectorAll('.lane').forEach(button => button.addEventListener('click', () => laneClick(Number(button.dataset.lane))));
  ui.hand.innerHTML = battle.hand.map(card => `<button class="hand-card card ${selectedId === card.id ? 'selected' : ''} ${card.rarity === 'rare' ? 'rare' : ''}" data-id="${card.id}" data-key="${card.key}">${cardInnerHtml(card)}</button>`).join('');
  ui.hand.querySelectorAll('.hand-card').forEach(button => button.addEventListener('click', () => selectCard(button.dataset.id)));
  ui.mainCount.textContent = battle.deck.length; ui.sideCount.textContent = battle.sideDeck.length;
  ui.mainDeck.disabled = busy || battle.hasDrawn || !battle.deck.length; ui.sideDeck.disabled = busy || battle.hasDrawn || !battle.sideDeck.length;
  ui.bellButton.disabled = busy || !battle.hasDrawn;
  ui.maneuverButton.disabled = busy || battle.tacticUsed || tutorial.active;
  ui.mendButton.disabled = busy || battle.tacticUsed || tutorial.active || battle.bones < 2;
  ui.maneuverButton.classList.toggle('active', tacticMode === 'maneuver');
  ui.mendButton.classList.toggle('active', tacticMode === 'mend');
  ui.bonesReadout.textContent = battle.bones;
  ui.bonePile.innerHTML = Array.from({ length: Math.min(10, battle.bones) }, (_, index) => `<i class="bone-token" style="--r:${-26 + (index * 17) % 55}deg;--x:${(index % 4) * 9}px;--y:${Math.floor(index / 4) * -7}px"></i>`).join('');
  ui.turnReadout.textContent = battle.turn <= MATCH_RULES.regulationTurns ? `Turn ${battle.turn} / ${MATCH_RULES.regulationTurns}` : `Sudden death · ${battle.turn}`;
  ui.phaseReadout.textContent = battle.hasDrawn ? 'Play cards or ring' : 'Choose one draw';
  const enemyPower = battle.opponentLanes.reduce((sum, card) => sum + (card?.power || 0), 0);
  ui.enemyPower.textContent = enemyPower ? `${enemyPower} Power on the felt` : 'No attackers on the felt';
  renderScale(battle.scale);
  ui.instruction.textContent = instructionText();
  const card = selectedCard();
  ui.actionTray.hidden = !card; ui.offerButton.hidden = !(card && selectionStage === 'sacrifice' && offeredBlood() >= card.cost.amount);
  ui.selectionSummary.textContent = card ? selectionText(card) : '';
  ui.tableScreen.classList.toggle('busy', busy);
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
    return `<button class="reward-card" data-key="${key}" aria-label="Choose ${card.name}">${cardHtml(card)}</button>`;
  }).join('');
  ui.rewardChoices.querySelectorAll('button').forEach(button => button.addEventListener('click', () => takeReward(button.dataset.key)));
}

function renderScoutChoices() {
  ui.scoutChoices.innerHTML = scoutOptions.map(card => `<button class="reward-card" data-id="${card.id}" aria-label="Draw ${card.name}">${cardHtml(card)}</button>`).join('');
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
  ui.titleScreen.hidden = scene !== 'title'; ui.tableScreen.hidden = scene !== 'battle'; ui.rewardScreen.hidden = scene !== 'reward';
  ui.resultScreen.hidden = !['victory', 'retry', 'defeat'].includes(scene);
  if (scene === 'battle') { renderBattle(); renderTurnLog(); } if (scene === 'reward') renderRewards(); if (['victory', 'retry', 'defeat'].includes(scene)) renderResult();
  renderTutorial(); renderAudioControls();
}

ui.startButton.addEventListener('click', () => startRun(tutorial.shouldAutoStart()));
ui.tutorialButton.addEventListener('click', () => { tutorial.replay(); startRun(); });
ui.restartButton.addEventListener('click', () => { if (scene === 'retry') { run = retryBattle(run); startBattle(); } else startRun(); });
ui.mainDeck.addEventListener('click', () => draw('main')); ui.sideDeck.addEventListener('click', () => draw('side'));
ui.maneuverButton.addEventListener('click', () => chooseTactic('maneuver')); ui.mendButton.addEventListener('click', () => chooseTactic('mend'));
ui.scoutDialog.addEventListener('cancel', event => event.preventDefault());
ui.bellButton.addEventListener('click', ringBell); ui.offerButton.addEventListener('click', lockOffering); ui.cancelButton.addEventListener('click', clearSelection);
ui.rulesButton.addEventListener('click', () => { audio.playCue('ui'); ui.rulesDialog.showModal(); });
ui.audioButton.addEventListener('click', () => { audio.playCue('ui'); renderAudioControls(); ui.audioDialog.showModal(); });
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
  advanceTutorial('continue'); render();
  if (finalStep) showToast('GUIDED HAND COMPLETE · THE TABLE IS YOURS');
});
ui.tutorialSkip.addEventListener('click', () => { tutorial.skip(); render(); showToast('TUTORIAL SKIPPED · REPLAY IT FROM THE RULEBOOK'); });
ui.sigilGlossary.innerHTML = Object.values(SIGILS).map(([, name, description]) => `<p><b>${name}</b><br>${description}</p>`).join('');

if (new URLSearchParams(location.search).has('debug')) {
  window.__BLOOD_BONE__ = {
    snapshot: () => ({ scene, encounter: run?.encounter ?? null, turn: battle?.turn ?? null, handCount: battle?.hand.length ?? 0, playerCards: battle?.playerLanes.filter(Boolean).map(card => card.key) || [], opponentCards: battle?.opponentLanes.filter(Boolean).map(card => card.key) || [], bones: battle?.bones ?? 0, scale: battle?.scale ?? 0, tacticUsed: battle?.tacticUsed ?? false, tutorial: tutorial.current()?.id || null, audio: audio.snapshot(), turnLog: ledger.snapshot(), preview: preview.map(entry => ({ lane: entry.lane, key: entry.card.key })) }),
    winBattle: () => { if (scene === 'battle') finishBattle(true); },
    loseBattle: () => { if (scene === 'battle') finishBattle(false); },
  };
}

render();
