import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

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

try {
  await page.goto('http://127.0.0.1:4174/?debug=1', { waitUntil: 'networkidle' });
  const soundtrackResponse = await page.request.get('http://127.0.0.1:4174/artifacts/hamlet.mp3');
  assert.equal(soundtrackResponse.status(), 200);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#titleScreen').isVisible(), true);
  await page.screenshot({ path: 'artifacts/title.png', fullPage: true });

  // The first visit enters a deterministic, real-action tutorial.
  await page.locator('#startButton').click();
  await page.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().tutorial === 'welcome');
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().audio.musicPlaying === true);
  const openingAudio = await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio);
  assert.equal(openingAudio.contextState, 'running');
  assert.match(openingAudio.musicSrc, /artifacts\/hamlet\.mp3$/);
  assert.equal(await page.locator('#ledgerPanel').isVisible(), true);
  assert.match(await page.locator('#turnLog').innerText(), /Turn 1[\s\S]*Woodsman takes the opposite seat[\s\S]*Incoming this turn/i);
  assert.equal(await page.locator('#tutorialOverlay').isVisible(), true);
  assert.ok(await page.locator('.preview-card').count() >= 1);
  await page.screenshot({ path: 'artifacts/tutorial.png', fullPage: true });
  await page.locator('#tutorialContinue').click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().tutorial === 'select-squirrel');
  await page.screenshot({ path: 'artifacts/tutorial-action.png', fullPage: true });

  const laneZero = page.locator('.lane.player[data-lane="0"]');
  await page.locator('.hand-card[data-key="squirrel"]').click();
  await laneZero.click();
  assert.deepEqual(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().playerCards), ['squirrel']);
  assert.match(await page.locator('#turnLog').innerText(), /You play Squirrel in lane 1\./);
  await page.locator('.hand-card[data-key="stoat"]').click();
  await laneZero.click();
  await page.locator('#offerButton').click();
  await laneZero.click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().tutorial === 'explain-bones');
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().bones), 1);
  assert.equal(await page.locator('#bonePile .bone-token').count(), 1);
  const paymentLog = await page.locator('#turnLog').innerText();
  assert.match(paymentLog, /You offer Squirrel for 1 Blood and gain 1 Bone\./);
  assert.match(paymentLog, /You play Stoat in lane 1\./);
  await page.locator('#tutorialContinue').click();
  await page.locator('#bellButton').click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().turn >= 2 && window.__BLOOD_BONE__.snapshot().tutorial === 'draw-squirrel');
  const combatLog = await page.locator('#turnLog').innerText();
  assert.match(combatLog, /You ring the bell\. Your creatures attack from left to right\./);
  assert.match(combatLog, /Stoat attacks through open lane 1 for 1 scale damage\./);
  assert.match(combatLog, /The opponent sends Stoat into lane 3\./);
  assert.match(combatLog, /Turn 2[\s\S]*Choose either the creature deck or the Squirrel deck/i);
  await page.locator('#sideDeck').click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().tutorial === 'complete');
  await page.locator('#tutorialContinue').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('bb_tutorial_completed')), 'true');
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().tutorial), null);
  assert.ok((await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio.cueCount)) >= 12);
  await page.waitForTimeout(2400);

  // Sound controls change and persist independent levels without interrupting the track.
  await page.locator('#audioButton').click();
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
  await page.screenshot({ path: 'artifacts/audio-controls.png', fullPage: true });
  await page.locator('#audioDialog .dialog-close').click();

  // Newest ledger event stays visible; the paper ledger can collapse without covering play.
  const atNewestEntry = await page.locator('#turnLog').evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 2);
  assert.equal(atNewestEntry, true);
  await page.screenshot({ path: 'artifacts/turn-ledger.png', fullPage: true });
  await page.locator('#ledgerToggle').click();
  assert.equal(await page.locator('#ledgerPanel').getAttribute('class'), 'turn-ledger collapsed');
  assert.equal(await page.locator('#ledgerToggle').getAttribute('aria-expanded'), 'false');
  await page.locator('#ledgerToggle').click();

  // Every visible card is now an illustrated physical card.
  assert.equal(await page.locator('.card').count(), await page.locator('.card .portrait svg').count());
  assert.equal(await page.locator('.lane.player').count(), 4);
  assert.equal(await page.locator('.lane.opponent').count(), 4);
  await page.screenshot({ path: 'artifacts/battle.png', fullPage: true });

  // Full run progression remains intact.
  await page.evaluate(() => window.__BLOOD_BONE__.winBattle());
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'reward');
  assert.equal(await page.locator('.reward-card').count(), 3);
  assert.equal(await page.locator('.reward-card .portrait svg').count(), 3);
  await page.screenshot({ path: 'artifacts/reward.png', fullPage: true });
  await page.locator('.reward-card').first().click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().encounter === 1);
  await page.evaluate(() => window.__BLOOD_BONE__.winBattle());
  await page.locator('.reward-card').first().click();
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().encounter === 2);
  await page.evaluate(() => window.__BLOOD_BONE__.winBattle());
  await page.waitForFunction(() => window.__BLOOD_BONE__.snapshot().scene === 'victory');
  await page.screenshot({ path: 'artifacts/victory.png', fullPage: true });

  // Completion persists: a later run does not force onboarding again.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#startButton').click();
  await page.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().scene === 'battle');
  assert.equal(await page.evaluate(() => window.__BLOOD_BONE__.snapshot().tutorial), null);
  const restoredAudio = await page.evaluate(() => window.__BLOOD_BONE__.snapshot().audio);
  assert.equal(restoredAudio.musicVolume, .31);
  assert.equal(restoredAudio.sfxVolume, .64);
  assert.equal(restoredAudio.musicPlaying, true);

  // Mobile layout keeps page width contained and preserves the internal board scroller.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  captureErrors(mobile);
  await mobile.addInitScript(() => localStorage.setItem('bb_tutorial_completed', 'true'));
  await mobile.goto('http://127.0.0.1:4174/?debug=1', { waitUntil: 'networkidle' });
  await mobile.locator('#startButton').click();
  await mobile.waitForFunction(() => window.__BLOOD_BONE__?.snapshot().scene === 'battle');
  const widths = await mobile.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(widths.page <= widths.viewport + 1, `mobile page overflows: ${JSON.stringify(widths)}`);
  await mobile.screenshot({ path: 'artifacts/mobile-battle.png', fullPage: true });
  await mobile.close();

  assert.deepEqual(errors, []);
  console.log('E2E OK: semantic turn ledger, soundtrack playback, SFX, creature calls, tutorial, illustrated cards, 3 encounters, rewards, victory, mobile, console');
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
