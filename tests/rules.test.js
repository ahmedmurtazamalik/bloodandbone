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

test('rulebook explains scale math and gives a worked exchange', () => {
  assert.match(html, /five points ahead/i);
  assert.match(html, /3 Power.*1 Power.*lead by 2/is);
  assert.match(html, /Bifurcated.*diagonal/is);
  assert.match(html, /Airborne.*flies over/is);
});
