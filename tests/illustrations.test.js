import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_LIBRARY } from '../src/cards.js';
import { CARD_ART } from '../src/illustrations.js';

test('every card template has a substantial local SVG illustration', () => {
  assert.deepEqual(Object.keys(CARD_ART).sort(), Object.keys(CARD_LIBRARY).sort());
  for (const [key, svg] of Object.entries(CARD_ART)) {
    assert.match(svg, /^<svg[^>]+viewBox="0 0 240 150"/);
    assert.match(svg, new RegExp(`data-card="${key}"`));
    assert.ok(svg.length > 500, `${key} artwork is too slight`);
    assert.doesNotMatch(svg, /<text/);
  }
});
