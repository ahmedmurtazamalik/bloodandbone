import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('rulebook explains card numbers, lane combat, and persistent damage', () => {
  assert.match(html, /Power is the damage/i);
  assert.match(html, /Health is how much damage/i);
  assert.match(html, /damage remains between turns/i);
  assert.match(html, /same numbered lane/i);
  assert.match(html, /left to right/i);
});

test('rulebook explains the full-round twelve-turn contest and special targeting', () => {
  assert.match(html, /opponent.*repl(?:y|ies).*before.*judg/is);
  assert.match(html, /cannot end before turn 8/i);
  assert.match(html, /12-point lead.*domination/i);
  assert.match(html, /turn 12.*leader wins/is);
  assert.match(html, /tie.*sudden death/is);
  assert.match(html, /3 Power.*1 Power.*lead by 2/is);
  assert.match(html, /Bifurcated Strike.*two diagonal lanes/is);
  assert.match(html, /Trifurcated Strike.*left.*forward.*right/is);
  assert.match(html, /Airborne.*flies over/is);
  assert.match(html, /one tactical action per turn.*Maneuver.*adjacent empty lane.*Mend.*2 Bones/is);
  assert.match(html, /creature deck.*reveal.*top three.*choose one.*other two.*bottom/is);
});
