import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_RULES, judgeMatch } from '../src/match-rules.js';

test('a trial cannot end before the minimum turn even at the domination margin', () => {
  assert.equal(judgeMatch({ turn: MATCH_RULES.minimumTurns - 1, scale: MATCH_RULES.dominationMargin }), null);
  assert.equal(judgeMatch({ turn: MATCH_RULES.minimumTurns - 1, scale: -MATCH_RULES.dominationMargin }), null);
});

test('domination can end a trial from turn eight onward', () => {
  assert.deepEqual(judgeMatch({ turn: 8, scale: 12 }), { winner: 'player', reason: 'domination' });
  assert.deepEqual(judgeMatch({ turn: 9, scale: -13 }), { winner: 'opponent', reason: 'domination' });
});

test('regulation ends on turn twelve for the leader while a tie enters sudden death', () => {
  assert.deepEqual(judgeMatch({ turn: 12, scale: 1 }), { winner: 'player', reason: 'regulation' });
  assert.deepEqual(judgeMatch({ turn: 12, scale: -1 }), { winner: 'opponent', reason: 'regulation' });
  assert.equal(judgeMatch({ turn: 12, scale: 0 }), null);
  assert.deepEqual(judgeMatch({ turn: 13, scale: 2 }), { winner: 'player', reason: 'sudden-death' });
});
