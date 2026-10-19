import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { CARD_LIBRARY } from '../src/cards.js';

const server = spawn('python3', ['-m', 'http.server', '4174'], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'ignore' });
async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4174/');
      if (response.ok) return;
    } catch { /* server is still binding */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Local game server did not become ready');
}
await waitForServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const captureErrors = target => {
  target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  target.on('pageerror', error => errors.push(error.message));
};
captureErrors(page);

async function assertGameViewport(target, label) {
  const dimensions = await target.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }));
  assert.ok(dimensions.width <= dimensions.viewportWidth + 1 && dimensions.height <= dimensions.viewportHeight + 1,
    `${label} leaves the game viewport: ${JSON.stringify(dimensions)}`);
}

async function assertTwoRowBoard(target, label, checkReachability = true) {
  assert.deepEqual(await target.locator('#board .lane-row').evaluateAll(rows => rows.map(row => row.id)), ['opponentRow', 'playerRow'], `${label} must have exactly two combat rows`);
  for (const row of ['opponentRow', 'playerRow']) {
    assert.deepEqual(await target.locator(`#${row} > .lane`).evaluateAll(lanes => lanes.map(lane => Number(lane.dataset.lane))), [0, 1, 2, 3]);
  }
  const lanePairs = await target.evaluate(() => [...document.querySelectorAll('#opponentRow > .lane')].map(opponent => {
    const enemy = opponent.getBoundingClientRect();
    const player = document.querySelector(`#playerRow > .lane[data-lane="${opponent.dataset.lane}"]`).getBoundingClientRect();
    return { lane: opponent.dataset.lane, enemyCenter: enemy.left + enemy.width / 2, playerCenter: player.left + player.width / 2, enemyWidth: enemy.width, playerWidth: player.width, enemyBottom: enemy.bottom, playerTop: player.top };
  }));
  for (const pair of lanePairs) {
    assert.ok(Math.abs(pair.enemyCenter - pair.playerCenter) <= 1 && Math.abs(pair.enemyWidth - pair.playerWidth) <= 1 && pair.enemyBottom <= pair.playerTop + 1, `${label} combat lane ${Number(pair.lane) + 1} is not aligned: ${JSON.stringify(pair)}`);
  }

  const expected = [...new Map((await battleSnapshot(target)).preview.map(entry => [entry.lane, entry])).values()].sort((a, b) => a.lane - b.lane);
  const layer = target.locator('#previewRow');
  assert.equal(await layer.locator('.lane, .card, .portrait, .empty-slot').count(), 0, 'Next plays must be annotations, without a third card row or empty slots');
  assert.equal(await layer.evaluate(element => getComputedStyle(element).position), 'absolute');
  assert.equal(await layer.isVisible(), expected.length > 0, 'An empty forecast must not leave a preview row');
  assert.equal(await layer.locator(':scope > *').count(), expected.length);
  assert.deepEqual(await layer.locator('.next-play.preview').evaluateAll(tags => tags.map(tag => Number(tag.dataset.lane))), expected.map(entry => entry.lane));
  for (const { lane, key } of expected) {
    const selector = `#previewRow > .next-play.preview[data-lane="${lane}"]`;
    const tag = target.locator(selector);
    const card = CARD_LIBRARY[key];
    assert.equal(await tag.locator('.next-play-name').innerText(), card.name);
    assert.equal(await tag.locator('.power b').innerText(), String(card.power));
    assert.equal(await tag.locator('.health b').innerText(), String(card.health));
    assert.match(await tag.getAttribute('aria-label'), new RegExp(`next play in lane ${lane + 1}:.*${card.name}.*Arrives after your attack`, 'i'));
    const bounds = await tag.evaluate(element => {
      const tag = element.getBoundingClientRect();
      const lane = document.querySelector(`#opponentRow > .lane[data-lane="${element.dataset.lane}"]`).getBoundingClientRect();
      const name = element.querySelector('.next-play-name');
      return { center: tag.left + tag.width / 2, laneCenter: lane.left + lane.width / 2, bottom: tag.bottom, laneTop: lane.top, height: tag.height, laneHeight: lane.height, clippedName: name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1 };
    });
    assert.ok(Math.abs(bounds.center - bounds.laneCenter) <= 1 && bounds.bottom <= bounds.laneTop + 1 && bounds.height < bounds.laneHeight * .75, `${label} next play must be a compact annotation above lane ${lane + 1}: ${JSON.stringify(bounds)}`);
    assert.equal(bounds.clippedName, false, `${label} next-play name is clipped`);
    await assertInViewport(target, selector, `${label} next play ${lane + 1}`);
    if (checkReachability) await assertActionReachable(target, selector);
  }
}

async function captureScreen(target, path) {
  await target.evaluate(() => window.scrollTo(0, 0));
  await target.screenshot({ path, fullPage: true });
}

async function assertInViewport(target, selector, label) {
  const bounds = await target.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  assert.ok(bounds.left >= -1 && bounds.right <= bounds.width + 1 && bounds.top >= -1 && bounds.bottom <= bounds.height + 1,
    `${label} outside viewport: ${JSON.stringify(bounds)}`);
}

async function checkDialogKeyboard(target, opener, dialog, label) {
  if (opener === '#rulesButton' || opener === '#audioButton') await openPause(target);
  await target.locator(opener).focus();
  await target.keyboard.press('Enter');
  assert.equal(await target.locator(dialog).isVisible(), true);
  await assertInViewport(target, dialog, label);
  for (let tab = 0; tab < 8; tab += 1) {
    await target.keyboard.press('Tab');
    // Chromium briefly reports body while native modal focus passes through browser chrome.
    const contained = await target.evaluate(id => document.activeElement === document.body || document.activeElement?.closest('dialog')?.id === id, dialog.slice(1));
    assert.equal(contained, true, `${label} moved focus into the inert background`);
  }
  await escapeDialog(target, dialog);
  assert.equal(await target.locator(dialog).isVisible(), false);
  const returnTarget = opener === '#rulesButton' || opener === '#audioButton' ? '#menuButton' : opener;
  assert.equal(await target.locator(returnTarget).evaluate(element => element === document.activeElement), true, `${label} did not restore opener focus`);
}

async function escapeDialog(target, selector) {
  await closeDialog(target, selector, () => target.keyboard.press('Escape'));
}

async function closeDialog(target, selector, action) {
  // Native close events restore focus after .open changes; wait before starting the next action.
  const observer = await target.locator(selector).evaluateHandle(dialog => {
    const observer = { dialog, closed: false };
    observer.onClose = () => { observer.closed = true; };
    dialog.addEventListener('close', observer.onClose, { once: true });
    return observer;
  });
  try {
    await action();
    await target.waitForFunction(observer => observer.closed, observer, { timeout: 5000 });
  } finally {
    await observer.evaluate(observer => observer.dialog.removeEventListener('close', observer.onClose));
    await observer.dispose();
  }
}

async function checkFocusedResize(target) {
  const before = await battleSnapshot(target);
  const origin = target.locator('#playerRow > .lane[data-lane="3"]');
  await origin.focus();
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 960 }]) {
    await target.setViewportSize(viewport);
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const position = await target.evaluate(() => ({ shell: document.querySelector('#gameShell').scrollTop, table: document.querySelector('#tableScreen').scrollTop, window: scrollY, hudTop: document.querySelector('.table-hud').getBoundingClientRect().top }));
    const { hudTop, ...scroll } = position;
    assert.deepEqual(scroll, { shell: 0, table: 0, window: 0 }, 'Resizing a focused game control must not scroll the stage');
    assert.ok(hudTop >= -1, `Resizing clips the HUD above the viewport: ${hudTop}`);
    await assertGameViewport(target, `focused resize ${viewport.width}`);
    await assertTwoRowBoard(target, `focused resize ${viewport.width}`);
    await assertInViewport(target, '#board', `focused resize ${viewport.width} board`);
    assert.equal(await origin.evaluate(element => element === document.activeElement), true, 'Resize must preserve the focused lane');
    assert.deepEqual(await battleSnapshot(target), before, 'Resize must preserve the two combat rows and battle state');
  }
  await dismissInspector(target);
}

async function openPause(target) {
  await target.locator('#menuButton').focus();
  await target.keyboard.press('Enter');
  assert.equal(await target.locator('#pauseDialog').isVisible(), true);
}

async function openMenuAction(target, selector) {
  await openPause(target);
  await target.locator(selector).focus();
  await target.keyboard.press('Enter');
  assert.equal(await target.locator('#pauseDialog').isVisible(), false);
}

async function battleSnapshot(target) {
  return target.evaluate(() => {
    const { audio, turnLog, ...state } = window.__BLOOD_BONE__.snapshot();
    return state;
  });
}

async function dismissInspector(target) {
  if (await target.locator('#cardInspector').isVisible()) {
    await target.keyboard.press('Escape');
    assert.equal(await target.locator('#cardInspector').isVisible(), false);
  }
}

async function activateFocused(target, selector) {
  await target.waitForFunction(selector => document.activeElement?.matches(selector), selector);
  await target.keyboard.press('Enter');
}

async function assertActionReachable(target, selector) {
  await target.waitForFunction(selector => {
    const element = document.querySelector(selector);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return element === hit || element.contains(hit);
  }, selector);
}

async function assertInspectorCard(target, card) {
  const name = await card.locator('.card-name, .next-play-name').innerText();
  const power = await card.locator('.power').innerText();
  const health = await card.locator('.health').innerText();
  await target.waitForFunction(() => !document.querySelector('#cardInspector')?.hidden);
  assert.equal(await target.locator('#cardInspector').isVisible(), true);
  assert.equal(await target.locator('#inspectorCard .card-name').innerText(), name);
  assert.equal(await target.locator('#inspectorCard .power').innerText(), power);
  assert.equal(await target.locator('#inspectorCard .health').innerText(), health);
  assert.ok((await target.locator('#inspectorDetails').textContent()).trim().length > 0, 'Inspection must describe the card');
  await assertInViewport(target, '#cardInspector', 'card inspector');
}

async function tapExposedCard(target, card) {
  const point = await card.evaluate(element => {
    const rect = element.getBoundingClientRect();
    for (const yRatio of [.4, .6, .2, .8]) for (const xRatio of [.25, .5, .75, .1]) {
      const x = rect.left + rect.width * xRatio;
      const y = rect.top + rect.height * yRatio;
      const hit = document.elementFromPoint(x, y);
      if (x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && (hit === element || element.contains(hit))) return { x, y };
    }
    return null;
  });
  assert.ok(point, 'A fanned card must expose a touch target');
  await target.touchscreen.tap(point.x, point.y);
}

async function assertCaptionLayout(target, container) {
  const labels = await target.locator(`${container} .choice-ability`).evaluateAll(abilities => abilities.flatMap(ability => [...ability.children]).map(element => {
    const rect = element.getBoundingClientRect();
    const button = element.closest('button').getBoundingClientRect();
    return { text: element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, button: { left: button.left, right: button.right, top: button.top, bottom: button.bottom }, viewport: { width: innerWidth, height: innerHeight }, width: element.clientWidth, height: element.clientHeight, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight };
  }));
  for (const label of labels) {
    assert.ok(label.text.trim(), 'Choice descriptions must contain readable text');
    assert.ok(label.left >= label.button.left - 1 && label.right <= label.button.right + 1 && label.top >= label.button.top - 1 && label.bottom <= label.button.bottom + 1,
      `Choice description escapes its button: ${label.text}`);
    assert.ok(label.left >= -1 && label.right <= label.viewport.width + 1 && label.top >= -1 && label.bottom <= label.viewport.height + 1,
      `Choice description is outside the viewport: ${label.text}`);
    assert.ok((!label.width || label.scrollWidth <= label.width + 1) && (!label.height || label.scrollHeight <= label.height + 1),
      `Choice description is clipped: ${label.text}`);
  }
  for (const [index, choice] of (await target.locator(`${container} .reward-card`).all()).entries()) {
    await assertActionReachable(target, `${container} > .reward-card:nth-child(${index + 1})`);
    assert.equal(await choice.isVisible(), true);
  }
}

async function assertChoiceAbilities(target, container) {
  for (const choice of await target.locator(`${container} .reward-card`).all()) {
    const expected = await choice.locator('.sigil').evaluateAll(sigils => sigils.map(sigil => {
      const divider = sigil.title.indexOf(': ');
      return { name: sigil.title.slice(0, divider), effect: sigil.title.slice(divider + 2) };
    }));
    const captions = await choice.locator('.choice-ability').evaluateAll(abilities => abilities.map(ability => ({ name: ability.querySelector('strong').textContent, effect: ability.querySelector('span').textContent })));
    assert.deepEqual(captions, expected, 'Choice buttons must display complete sigil names and effects');
    assert.equal(await choice.locator('.choice-abilities').count(), expected.length ? 1 : 0);
  }
  await assertCaptionLayout(target, container);
}

async function checkLongChoiceCaptions(target, container) {
  // These library sigils are absent from the current run's offers. Exercise their real glossary text as a CSS-only fixture.
  const originals = await target.locator(`${container} .reward-card`).evaluateAll(choices => choices.map(choice => choice.querySelector('.choice-abilities')?.outerHTML || null));
  const prepared = await target.evaluate(container => {
    const choices = [...document.querySelectorAll(`${container} .reward-card`)];
    const template = document.querySelector(`${container} .choice-ability`);
    if (!template) return false;
    for (const [index, name] of ['Fecundity', 'Unkillable'].entries()) {
      const glossary = [...document.querySelectorAll('#sigilGlossary p')].find(entry => entry.querySelector('b')?.textContent === name);
      const ability = template.cloneNode(true);
      ability.querySelector('strong').textContent = name;
      ability.querySelector('span').textContent = glossary.textContent.slice(name.length).trim();
      let captions = choices[index].querySelector('.choice-abilities');
      if (!captions) { captions = document.createElement('span'); captions.className = 'choice-abilities'; choices[index].append(captions); }
      captions.replaceChildren(ability);
    }
    return true;
  }, container);
  assert.equal(prepared, true, 'Long-caption fixture needs a rendered ability template');
  try {
    await assertCaptionLayout(target, container);
  } finally {
    await target.evaluate(({ container, originals }) => {
      [...document.querySelectorAll(`${container} .reward-card`)].forEach((choice, index) => {
        choice.querySelector('.choice-abilities')?.remove();
        if (originals[index]) choice.insertAdjacentHTML('beforeend', originals[index]);
      });
    }, { container, originals });
  }
  await assertChoiceAbilities(target, container);
}

async function checkLargeHand(target, label) {
  const limit = await target.evaluate(() => innerWidth <= 600 ? 5 : 7);
  while ((await battleSnapshot(target)).handCount < limit + 2) {
    const beforeTurn = (await battleSnapshot(target)).turn;
    await dismissInspector(target);
    await target.locator('#bellButton').click();
    await target.waitForFunction(turn => window.__BLOOD_BONE__.snapshot().turn > turn && !document.querySelector('#tableScreen').classList.contains('busy'), beforeTurn);
    await assertTwoRowBoard(target, `${label} turn ${(await battleSnapshot(target)).turn}`);
    await target.locator('#sideDeck').click();
    assert.equal((await battleSnapshot(target)).scene, 'battle');
  }
  await dismissInspector(target);
  const handCount = (await battleSnapshot(target)).handCount;
  assert.ok(await target.locator('.hand-card').count() <= limit, `${label} fan exceeds its bound`);
  assert.ok(Number(await target.locator('#hand').getAttribute('data-pages')) >= 2);
  while (!(await target.locator('#handPrevious').isDisabled())) await target.locator('#handPrevious').click();
  const firstIds = await target.locator('.hand-card').evaluateAll(cards => cards.map(card => card.dataset.id));
  const first = target.locator('.hand-card').first();
  await first.focus();
  // Paging restores focus without opening a tooltip; deliberate keyboard navigation does.
  await target.keyboard.press('Tab');
  await target.keyboard.press('Shift+Tab');
  await assertInspectorCard(target, first);
  await dismissInspector(target);
  while (!(await target.locator('#handNext').isDisabled())) await target.locator('#handNext').click();
  assert.ok(Number(await target.locator('#hand').getAttribute('data-page')) > 0);
  assert.match(await target.locator('#handPageReadout').innerText(), new RegExp(`/\\s*${handCount}$`));
  const last = target.locator('.hand-card').last();
  assert.equal(firstIds.includes(await last.getAttribute('data-id')), false, 'Paging must reveal previously hidden cards');
  await last.focus();
  await assertInspectorCard(target, last);
  await assertActionReachable(target, `.hand-card[data-id="${await last.getAttribute('data-id')}"]`);
  await target.keyboard.press('Enter');
  assert.equal(await last.getAttribute('aria-pressed'), 'true');
  await dismissInspector(target);
  await target.keyboard.press('Escape');
  assert.equal(await last.getAttribute('aria-pressed'), 'false');
  while (!(await target.locator('#handPrevious').isDisabled())) await target.locator('#handPrevious').click();
  assert.deepEqual(await target.locator('.hand-card').evaluateAll(cards => cards.map(card => card.dataset.id)), firstIds);
  await assertGameViewport(target, `${label} enlarged hand`);
}

try {
  await page.goto('http://127.0.0.1:4174/?debug=1', { waitUntil: 'networkidle' });
  const soundtrackResponse = await page.request.get('http://127.0.0.1:4174/artifacts/hamlet.mp3');
  assert.equal(soundtrackResponse.status(), 200);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#titleScreen').isVisible(), true);
  await captureScreen(page, 'artifacts/title.png');
  await checkDialogKeyboard(page, '#titleRulesButton', '#rulesDialog', 'title rules');
  await checkDialogKeyboard(page, '#titleAudioButton', '#audioDialog', 'title sound');
  await page.locator('#startButton').focus();

  // The first visit enters a deterministic, real-action tutorial.
  await activateFocused(page, '#startButton');
  await page.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().tutorial === 'welcome');
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().audio.musicPlaying === true);
  const openingAudio = await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio);
  assert.equal(openingAudio.contextState, 'running');
  assert.match(openingAudio.musicSrc, /artifacts\/hamlet\.mp3$/);
  assert.equal(await page.locator('#ledgerDialog').isVisible(), false, 'Battle history is optional at the table');
  assert.match(await page.locator('#turnLog').textContent(), /Turn 1[\s\S]*Woodsman takes the opposite seat[\s\S]*Incoming this turn/i);
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().bones), 1);
  assert.match(await page.locator('#turnLog').textContent(), /Marrow Reserve adds 1 Bone\. You have 1\./);
  assert.equal(await page.locator('#tutorialOverlay').isVisible(), true);
  const openingPreview = (await battleSnapshot(page)).preview;
  assert.ok(openingPreview.length > 0);
  await assertTwoRowBoard(page, 'opening tutorial', false);
  await page.screenshot({ path: 'artifacts/tutorial.png', fullPage: true });
  await activateFocused(page, '#tutorialContinue');
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().tutorial === 'select-squirrel');
  await page.screenshot({ path: 'artifacts/tutorial-action.png', fullPage: true });

  await activateFocused(page, '.hand-card[data-key="squirrel"]');
  await activateFocused(page, '.lane.player[data-lane="0"]');
  assert.deepEqual(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().playerCards), ['squirrel']);
  assert.match(await page.locator('#turnLog').textContent(), /You play Squirrel in lane 1\./);
  await activateFocused(page, '.hand-card[data-key="stoat"]');
  await activateFocused(page, '.lane.player[data-lane="0"]');
  await activateFocused(page, '#offerButton');
  await activateFocused(page, '.lane.player[data-lane="0"]');
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().tutorial === 'explain-bones');
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().bones), 2);
  assert.equal(await page.locator('#bonePile .bone-token').count(), 2);
  await assertActionReachable(page, '#boneReserve');
  const paymentLog = await page.locator('#turnLog').textContent();
  assert.match(paymentLog, /You offer Squirrel for 1 Blood and gain 1 Bone\./);
  assert.match(paymentLog, /You play Stoat in lane 1\./);
  await activateFocused(page, '#tutorialContinue');
  const deploymentObserved = page.waitForFunction(entries => entries.every(({ lane, key }) => document.querySelector(`#opponentRow > .lane[data-lane="${lane}"] > .card`)?.dataset.key === key) && document.querySelector('#previewRow').hidden && document.querySelector('#previewRow').childElementCount === 0, openingPreview);
  await activateFocused(page, '#bellButton');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#scaleReadout').innerText(), 'The balance is even');
  assert.match(await page.locator('#turnLog').textContent(), /ring the bell/i);
  await page.waitForFunction(() => document.querySelector('#turnLog')?.textContent.includes('Stoat attacks through open lane 1'));
  assert.equal(await page.locator('#scaleReadout').innerText(), 'You lead by 1');
  await page.screenshot({ path: 'artifacts/combat-playback.png', fullPage: true });
  await deploymentObserved;
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().turn >= 2 && window.__BLOOD_BONE__.snapshot().tutorial === 'draw-squirrel');
  await assertTwoRowBoard(page, 'tutorial after deployment', false);
  const combatLog = await page.locator('#turnLog').textContent();
  assert.match(combatLog, /You ring the bell\. Your creatures attack from left to right\./);
  assert.match(combatLog, /Stoat attacks through open lane 1 for 1 scale damage\./);
  assert.match(combatLog, /The opponent sends Stoat into lane 3\./);
  assert.match(combatLog, /Turn 2[\s\S]*Choose either the creature deck or the Squirrel deck/i);
  await activateFocused(page, '#sideDeck');
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().tutorial === 'complete');
  await activateFocused(page, '#tutorialContinue');
  assert.equal(await page.evaluate(() => localStorage.getItem('bb_tutorial_completed')), 'true');
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().tutorial), null);
  assert.equal(await page.locator('.hand-card:not(:disabled)').first().evaluate(element => element === document.activeElement), true, 'Tutorial completion must return focus to play');
  assert.ok((await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio.cueCount)) >= 12);
  const beforeOpponentInspection = await battleSnapshot(page);
  const deployedOpponent = page.locator('#opponentRow > .lane:has(.card)').first();
  await deployedOpponent.focus();
  await page.keyboard.press('Enter');
  await assertInspectorCard(page, deployedOpponent);
  assert.deepEqual(await battleSnapshot(page), beforeOpponentInspection, 'Deployed opponent inspection must preserve both combat rows and battle state');
  await dismissInspector(page);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0');
  await page.locator('#menuButton').focus();
  await captureScreen(page, 'artifacts/two-rows-desktop.png');
  await page.locator('#maneuverButton').click();
  await page.locator('#playerRow [data-lane="0"]').click();
  await page.locator('#playerRow [data-lane="1"]').click();
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().tacticUsed), true);
  assert.match(await page.locator('#turnLog').textContent(), /maneuver Stoat from lane 1 to lane 2/i);
  assert.equal(await page.locator('#maneuverButton').isDisabled(), true);
  await page.waitForTimeout(2400);
  await page.locator('#bellButton').click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().turn >= 3);
  const handBeforeScout = await page.evaluate(() => window.__BLOOD_BONE__.snapshot().handCount);
  await page.locator('#mainDeck').click();
  assert.equal(await page.locator('#scoutDialog').isVisible(), true);
  assert.equal(await page.locator('#scoutChoices .reward-card').count(), 3);
  await assertChoiceAbilities(page, '#scoutChoices');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#scoutDialog').isVisible(), true, 'Scout must require a card choice');
  await captureScreen(page, 'artifacts/scout.png');
  await page.locator('#scoutChoices .reward-card').nth(1).click();
  assert.equal(await page.locator('#scoutDialog').isVisible(), false);
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().handCount), handBeforeScout + 1);
  assert.match(await page.locator('#turnLog').textContent(), /You scout .* choose .* cycle the others to the bottom/i);
  await openMenuAction(page, '#ledgerButton');
  assert.equal(await page.locator('#ledgerDialog').isVisible(), true);
  await page.waitForFunction(() => {
    const element = document.querySelector('#turnLog');
    return element && element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
  });
  assert.equal(await page.locator('#turnLog').evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 2), true);
  await escapeDialog(page, '#ledgerDialog');
  assert.equal(await page.locator('#ledgerDialog').isVisible(), false);

  // The full rules dialog explains numbers, lane targeting, special strikes, and scale math.
  await openMenuAction(page, '#rulesButton');
  assert.equal(await page.locator('#rulesDialog').isVisible(), true);
  const rulesText = await page.locator('#rulesDialog').innerText();
  assert.match(rulesText, /Power is the damage[\s\S]*Health is how much damage/);
  assert.match(rulesText, /Bifurcated Strike[\s\S]*Airborne flies over/);
  assert.match(rulesText, /Wolf deals 3 Power[\s\S]*lead by 2/);
  await captureScreen(page, 'artifacts/rules.png');
  await page.locator('#replayTutorial').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#replayTutorial').isVisible(), true);
  assert.ok((await page.locator('#sigilGlossary').innerText()).includes('Stinky'));
  await captureScreen(page, 'artifacts/rules-sigils.png');
  await page.locator('#rulesDialog .dialog-close').click();

  // Sound controls change and persist independent levels without interrupting the track.
  await openMenuAction(page, '#audioButton');
  assert.equal(await page.locator('#audioDialog').isVisible(), true);
  await page.locator('#musicVolume').fill('31');
  await page.locator('#sfxVolume').fill('64');
  await page.locator('#muteButton').click();
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio.muted), true);
  await page.locator('#muteButton').click();
  const adjustedAudio = await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio);
  assert.equal(adjustedAudio.muted, false);
  assert.equal(adjustedAudio.musicVolume, .31);
  assert.equal(adjustedAudio.sfxVolume, .64);
  assert.equal(adjustedAudio.musicPlaying, true);
  await captureScreen(page, 'artifacts/audio-controls.png');
  await page.locator('#audioDialog .dialog-close').click();

  // Battle history opens when requested and returns the player to the table.
  await openMenuAction(page, '#ledgerButton');
  assert.equal(await page.locator('#ledgerDialog').isVisible(), true);
  await captureScreen(page, 'artifacts/turn-ledger.png');
  await escapeDialog(page, '#ledgerDialog');
  assert.equal(await page.locator('#ledgerDialog').isVisible(), false);
  assert.equal(await page.locator('#menuButton').evaluate(element => element === document.activeElement), true);

  // Every visible card is now an illustrated physical card.
  assert.equal(await page.locator('.card').count(), await page.locator('.card .portrait svg').count());
  assert.equal(await page.locator('.lane.player').count(), 4);
  assert.equal(await page.locator('.lane.opponent').count(), 4);
  await captureScreen(page, 'artifacts/battle.png');

  // Full run progression remains intact.
  await page.evaluate(() => window.__BLOOD_BONE__.winBattle());
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'reward');
  assert.equal(await page.locator('#rewardChoices .reward-card').count(), 3);
  assert.equal(await page.locator('#rewardChoices .reward-card .portrait svg').count(), 3);
  await assertChoiceAbilities(page, '#rewardChoices');
  const firstRewardKeys = await page.locator('#rewardChoices .reward-card').evaluateAll(cards => cards.map(card => card.dataset.key));
  await captureScreen(page, 'artifacts/reward.png');
  await page.locator('#rewardChoices .reward-card').first().click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().encounter === 1);
  await page.evaluate(() => window.__BLOOD_BONE__.winBattle());
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'reward');
  await assertChoiceAbilities(page, '#rewardChoices');
  const secondRewardKeys = await page.locator('#rewardChoices .reward-card').evaluateAll(cards => cards.map(card => card.dataset.key));
  assert.equal(secondRewardKeys.some(key => firstRewardKeys.includes(key)), false);
  await page.locator('#rewardChoices .reward-card').first().click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().encounter === 2);
  await page.evaluate(() => window.__BLOOD_BONE__.winBattle());
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'victory');
  await captureScreen(page, 'artifacts/victory.png');

  // Completion persists: a later run does not force onboarding again.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#startButton').click();
  await page.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().scene === 'battle');
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().tutorial), null);
  const restoredAudio = await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio);
  assert.equal(restoredAudio.musicVolume, .31);
  assert.equal(restoredAudio.sfxVolume, .64);
  assert.equal(restoredAudio.musicPlaying, true);

  // A first loss retries the same trial with two Broken Bones; the second loss is final.
  const catchup = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  captureErrors(catchup);
  await catchup.addInitScript(() => localStorage.setItem('bb_tutorial_completed', 'true'));
  await catchup.goto('http://127.0.0.1:4174/?debug=1', { waitUntil: 'networkidle' });
  await catchup.locator('#startButton').click();
  await catchup.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().scene === 'battle');
  await catchup.evaluate(() => window.__BLOOD_BONE__.loseBattle());
  await catchup.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'retry');
  assert.match(await catchup.locator('#resultScreen').innerText(), /RISE WITH BROKEN BONES[\s\S]*2 emergency Bones[\s\S]*RETRY THIS TRIAL/i);
  await captureScreen(catchup, 'artifacts/broken-bones.png');
  await catchup.locator('#restartButton').click();
  await catchup.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'battle');
  assert.equal(await catchup.evaluate(() => window.__BLOOD_BONE__.snapshot().encounter), 0);
  assert.equal(await catchup.evaluate(() => window.__BLOOD_BONE__.snapshot().bones), 3);
  assert.match(await catchup.locator('#turnLog').textContent(), /Marrow Reserve adds 1 Bone[\s\S]*Broken Bones add 2 Bones\. You have 3/i);
  await catchup.evaluate(() => window.__BLOOD_BONE__.loseBattle());
  await catchup.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'defeat');
  assert.match(await catchup.locator('#resultScreen').innerText(), /YOUR CANDLE GOES DARK[\s\S]*DEAL AGAIN/i);
  await catchup.close();

  // All layouts retain contained pages, keyboard card play, modal focus, and reachable choices.
  for (const viewport of [{ width: 1440, height: 960 }, { width: 1366, height: 768 }, { width: 1024, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }, { width: 390, height: 844, mouse: true }, { width: 844, height: 390 }, { width: 640, height: 360 }]) {
    const touch = !viewport.mouse && (viewport.width <= 390 || viewport.height <= 390);
    const responsive = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: touch, hasTouch: touch });
    captureErrors(responsive);
    await responsive.addInitScript(() => localStorage.setItem('bb_tutorial_completed', 'true'));
    const label = `${viewport.width}×${viewport.height} ${touch ? 'touch' : 'mouse'}`;
    await responsive.goto('http://127.0.0.1:4174/?debug=1', { waitUntil: 'networkidle' });
    await assertGameViewport(responsive, `${label} title`);
    assert.equal(await responsive.locator('#startButton').evaluate(element => element === document.activeElement), true);
    await responsive.keyboard.press('Enter');
    await responsive.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().scene === 'battle');
    await assertGameViewport(responsive, `${label} battle`);
    await assertTwoRowBoard(responsive, label);
    assert.equal(await responsive.locator('#ledgerDialog').isVisible(), false);
    for (const selector of ['#board', '#hand', '#bellButton', '#mainDeck', '#sideDeck']) await assertInViewport(responsive, selector, `${label} ${selector}`);

    const beforeInspection = await battleSnapshot(responsive);
    const incoming = responsive.locator('#previewRow > .next-play.preview').first();
    if (touch) await incoming.tap();
    else if (viewport.width === 1440) { await incoming.focus(); await responsive.keyboard.press('Enter'); }
    else { await incoming.hover(); await incoming.click(); }
    await assertInspectorCard(responsive, incoming);
    assert.match(await responsive.locator('#inspectorDetails .inspection-context').innerText(), /Next play · lane \d[\s\S]*Arrives after your attack\./);
    assert.deepEqual(await battleSnapshot(responsive), beforeInspection, 'Incoming inspection must preserve battle state');
    assert.equal(await responsive.locator('.hand-card[aria-pressed="true"]').count(), 0);
    await dismissInspector(responsive);
    await openMenuAction(responsive, '#deckViewButton');
    assert.equal(await responsive.locator('#deckDialog').isVisible(), true);
    assert.equal(await responsive.locator('#deckChoices .card').count(), 9);
    await assertInViewport(responsive, '#deckDialog', `${label} deck collection`);
    const lastDeckCard = responsive.locator('#deckChoices .deck-card').last();
    await lastDeckCard.scrollIntoViewIfNeeded();
    if (touch) await lastDeckCard.tap();
    else { await lastDeckCard.focus(); await responsive.keyboard.press('Enter'); }
    await assertInspectorCard(responsive, lastDeckCard);
    await assertActionReachable(responsive, '#inspectorClose');
    if (touch) await responsive.locator('#inspectorClose').tap();
    else await responsive.locator('#inspectorClose').click();
    assert.equal(await responsive.locator('#cardInspector').isVisible(), false);
    assert.equal(await lastDeckCard.evaluate(element => element === document.activeElement), true, 'Deck inspection should return to its source card');
    assert.deepEqual(await battleSnapshot(responsive), beforeInspection);
    await escapeDialog(responsive, '#deckDialog');
    assert.equal(await responsive.locator('#deckDialog').isVisible(), false);

    await openPause(responsive);
    await assertInViewport(responsive, '#pauseDialog', `${label} pause menu`);
    assert.deepEqual(await battleSnapshot(responsive), beforeInspection, 'Opening the menu must preserve battle state');
    await closeDialog(responsive, '#pauseDialog', () => responsive.locator('#resumeButton').click());
    assert.equal(await responsive.locator('#pauseDialog').isVisible(), false);
    assert.equal(await responsive.evaluate(() => {
      const active = document.activeElement;
      return active?.matches('button, input') && !active.closest('dialog:not([open])') && active.getBoundingClientRect().width > 0;
    }), true, 'Resume must return focus to an available game control');

    const squirrel = responsive.locator('.hand-card[data-key="squirrel"]').first();
    if (touch) {
      await tapExposedCard(responsive, squirrel);
      assert.equal(await squirrel.getAttribute('aria-pressed'), 'true');
      assert.equal(await responsive.locator('#cardInspector').isVisible(), false, 'Touch selection should wait for explicit inspection');
      await responsive.locator('#inspectButton').tap();
      await assertInspectorCard(responsive, squirrel);
      await responsive.keyboard.press('Escape');
      assert.equal(await squirrel.getAttribute('aria-pressed'), 'true');
      await responsive.keyboard.press('Escape');
      assert.equal(await squirrel.getAttribute('aria-pressed'), 'false');
      assert.equal(await squirrel.evaluate(element => element === document.activeElement), true);
      assert.deepEqual(await battleSnapshot(responsive), beforeInspection);
      await responsive.locator('#menuButton').focus();
    }
    await squirrel.focus();
    await assertInspectorCard(responsive, squirrel);
    const selectedId = await squirrel.getAttribute('data-id');
    await responsive.keyboard.press('Enter');
    assert.equal(await squirrel.getAttribute('aria-pressed'), 'true');
    assert.equal(await responsive.evaluate(() => document.activeElement?.dataset.id), selectedId, `${label} card selection lost focus`);
    if (touch) await responsive.locator('#inspectButton').tap();
    else await responsive.locator('#inspectButton').click();
    await assertInspectorCard(responsive, squirrel);
    await responsive.keyboard.press('Escape');
    assert.equal(await responsive.locator('#cardInspector').isVisible(), false);
    assert.equal(await squirrel.getAttribute('aria-pressed'), 'true', 'Inspection dismissal must preserve the offering');
    await responsive.keyboard.press('Escape');
    assert.equal(await responsive.locator('#actionTray').isVisible(), false);
    assert.equal(await squirrel.getAttribute('aria-pressed'), 'false');
    assert.equal(await squirrel.evaluate(element => element === document.activeElement), true, 'Cancellation should return focus to the card');
    await squirrel.focus();
    await responsive.keyboard.press('Enter');
    await openPause(responsive);
    await escapeDialog(responsive, '#pauseDialog');
    assert.equal(await responsive.locator('#pauseDialog').isVisible(), false);
    assert.equal(await squirrel.getAttribute('aria-pressed'), 'true', 'Menu dismissal must preserve the offering');
    await checkDialogKeyboard(responsive, '#rulesButton', '#rulesDialog', `${label} rules`);
    assert.equal(await squirrel.getAttribute('aria-pressed'), 'true', 'Closing a modal must preserve the card selection');
    await checkDialogKeyboard(responsive, '#audioButton', '#audioDialog', `${label} sound`);
    const lastLane = responsive.locator('.lane.player[data-lane="3"]');
    await lastLane.focus();
    await assertActionReachable(responsive, '.lane.player[data-lane="3"]');
    await responsive.keyboard.press('Enter');
    assert.deepEqual(await responsive.evaluate(() => window.__BLOOD_BONE__.snapshot().playerCards), ['squirrel']);
    assert.equal(await lastLane.evaluate(element => element === document.activeElement), true, `${label} lane placement lost focus`);
    if (viewport.width === 1440) await checkFocusedResize(responsive);
    await responsive.locator('#maneuverButton').focus();
    await responsive.keyboard.press('Enter');
    assert.equal(await responsive.locator('#actionTray').isVisible(), true);
    assert.equal(await responsive.locator('#cancelButton').innerText(), 'Cancel tactic');
    await dismissInspector(responsive);
    await responsive.keyboard.press('Escape');
    assert.equal(await responsive.locator('#actionTray').isVisible(), false);
    assert.equal(await responsive.locator('#maneuverButton').getAttribute('aria-pressed'), 'false');
    await assertGameViewport(responsive, `${label} after lane scroll`);
    await captureScreen(responsive, `artifacts/battle-${viewport.width}${viewport.mouse ? '-mouse' : ''}.png`);
    if (viewport.width === 1440 || (viewport.width === 390 && touch)) await checkLargeHand(responsive, label);

    const beforeScoutTurn = (await battleSnapshot(responsive)).turn;
    await dismissInspector(responsive);
    await responsive.locator('#bellButton').click();
    await responsive.waitForFunction(turn => window.__BLOOD_BONE__.snapshot().turn > turn && !document.querySelector('#tableScreen').classList.contains('busy'), beforeScoutTurn);
    await assertTwoRowBoard(responsive, `${label} after combat`);
    if (viewport.width === 390 && touch) await captureScreen(responsive, 'artifacts/two-rows-mobile.png');
    await responsive.locator('#mainDeck').click();
    await assertInViewport(responsive, '#scoutDialog', `${label} Scout choices`);
    await assertChoiceAbilities(responsive, '#scoutChoices');
    if (touch) await captureScreen(responsive, `artifacts/scout-caption-${viewport.width}.png`);
    await responsive.locator('#scoutChoices .reward-card').first().click();
    assert.equal(await responsive.locator('#scoutDialog').isVisible(), false);

    if (viewport.width === 1366) await openPause(responsive);
    await responsive.evaluate(() => window.__BLOOD_BONE__.winBattle());
    await responsive.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'reward');
    assert.equal(await responsive.locator('#pauseDialog').isVisible(), false, 'A scene change must close the old menu');
    await assertGameViewport(responsive, `${label} reward`);
    await assertChoiceAbilities(responsive, '#rewardChoices');
    if (viewport.width === 320 || viewport.width === 640) await checkLongChoiceCaptions(responsive, '#rewardChoices');
    assert.equal(await responsive.locator('#rewardChoices .reward-card').first().evaluate(element => element === document.activeElement), true);
    for (const choice of await responsive.locator('#rewardChoices .reward-card').all()) {
      await choice.scrollIntoViewIfNeeded();
      const bounds = await choice.boundingBox();
      assert.ok(bounds.width > 0 && bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y >= -1 && bounds.y + bounds.height <= viewport.height + 1, `${label} reward card is clipped`);
    }
    await captureScreen(responsive, `artifacts/reward-${viewport.width}${viewport.mouse ? '-mouse' : ''}.png`);
    await responsive.close();
  }

  // Coaching must keep actions reachable on portrait and landscape phone tables.
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
    const width = viewport.width;
    const guided = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    captureErrors(guided);
    await guided.goto('http://127.0.0.1:4174/?debug=1', { waitUntil: 'networkidle' });
    await activateFocused(guided, '#startButton');
    await guided.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().tutorial === 'welcome');
    await activateFocused(guided, '#tutorialContinue');
    for (const selector of ['.hand-card[data-key="squirrel"]', '.lane.player[data-lane="0"]', '.hand-card[data-key="stoat"]', '.lane.player[data-lane="0"]', '#offerButton', '.lane.player[data-lane="0"]']) {
      await assertActionReachable(guided, selector);
      await activateFocused(guided, selector);
    }
    assert.equal(await guided.evaluate(() => window.__BLOOD_BONE__.snapshot().tutorial), 'explain-bones');
    assert.deepEqual(await guided.evaluate(() => window.__BLOOD_BONE__.snapshot().playerCards), ['stoat']);
    await assertInViewport(guided, '#boneReserve', `${width}px Bone reserve`);
    await assertActionReachable(guided, '#boneReserve');
    await assertInViewport(guided, '#tutorialOverlay', `${width}px tutorial coach`);
    await guided.screenshot({ path: `artifacts/tutorial-${width}.png`, fullPage: true });
    await activateFocused(guided, '#tutorialContinue');
    await assertActionReachable(guided, '#bellButton');
    if (width === 320) {
      await guided.locator('#tutorialSkip').focus();
      await guided.keyboard.press('Enter');
    } else {
      await activateFocused(guided, '#bellButton');
      await guided.waitForFunction(() => window.__BLOOD_BONE__.snapshot().turn >= 2 && window.__BLOOD_BONE__.snapshot().tutorial === 'draw-squirrel');
      await assertActionReachable(guided, '#sideDeck');
      await activateFocused(guided, '#sideDeck');
      await assertActionReachable(guided, '#tutorialContinue');
      await activateFocused(guided, '#tutorialContinue');
    }
    assert.equal(await guided.evaluate(() => window.__BLOOD_BONE__.snapshot().tutorial), null);
    assert.equal(await guided.locator('.hand-card:not(:disabled)').first().evaluate(element => element === document.activeElement), true, 'Leaving the tutorial must return focus to play');
    await guided.close();
  }

  assert.deepEqual(errors, []);
  console.log('E2E OK: two-row board and next-play deployment, immersive viewport, tutorial/combat/scout, soundtrack/SFX, optional log/deck/menu, card inspector, bounded hand paging, run/retry/victory, keyboard/Escape, desktop/tablet/phone/landscape, console');
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
