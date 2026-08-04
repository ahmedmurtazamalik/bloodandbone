import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_RULES, judgeMatch } from '../src/match-rules.js';

test('a trial cannot end before the minimum turn even at the domination margin', () => {
  assert.equal(judgeMatch({ turn: MATCH_RULES.minimumTurns - 1, scale: MATCH_RULES.dominationMargin }), null);
  assert.equal(judgeMatch({ turn: MATCH_RULES.minimumTurns - 1, scale: -MATCH_RULES.dominationMargin }), null);
});

test('domination can end a trial from turn twelve onward at a twenty-point lead', () => {
  assert.equal(MATCH_RULES.minimumTurns, 12);
  assert.equal(MATCH_RULES.dominationMargin, 20);
  assert.deepEqual(judgeMatch({ turn: 12, scale: 20 }), { winner: 'player', reason: 'domination' });
  assert.deepEqual(judgeMatch({ turn: 13, scale: -21 }), { winner: 'opponent', reason: 'domination' });
});

test('regulation ends on turn sixteen for the leader while a tie enters sudden death', () => {
  assert.equal(MATCH_RULES.regulationTurns, 16);
  assert.deepEqual(judgeMatch({ turn: 16, scale: 1 }), { winner: 'player', reason: 'regulation' });
  assert.deepEqual(judgeMatch({ turn: 16, scale: -1 }), { winner: 'opponent', reason: 'regulation' });
  assert.equal(judgeMatch({ turn: 16, scale: 0 }), null);
  assert.deepEqual(judgeMatch({ turn: 17, scale: 2 }), { winner: 'player', reason: 'sudden-death' });
});
