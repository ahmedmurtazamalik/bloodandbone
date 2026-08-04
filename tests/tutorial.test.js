import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorialController, TUTORIAL_STEPS } from '../src/tutorial.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test('a first-time tutorial gates the real action sequence', () => {
  const tutorial = new TutorialController(memoryStorage());
  assert.equal(tutorial.shouldAutoStart(), true);
  tutorial.start();
  assert.equal(tutorial.current().id, 'welcome');
  assert.equal(tutorial.allows('select-card', 'squirrel'), false);

  assert.equal(tutorial.perform('continue'), true);
  assert.equal(tutorial.current().id, 'select-squirrel');
  assert.equal(tutorial.allows('select-card', 'stoat'), false);
  assert.equal(tutorial.perform('select-card', 'squirrel'), true);
  assert.equal(tutorial.perform('place-lane', 1), false);
  assert.equal(tutorial.perform('place-lane', 0), true);
  assert.equal(tutorial.perform('select-card', 'stoat'), true);
  assert.equal(tutorial.perform('mark-sacrifice', 0), true);
  assert.equal(tutorial.perform('lock-offer'), true);
  assert.equal(tutorial.perform('place-lane', 0), true);
  assert.equal(tutorial.current().id, 'explain-bones');
  assert.equal(tutorial.perform('continue'), true);
  assert.equal(tutorial.perform('ring-bell'), true);
  assert.equal(tutorial.perform('draw', 'main'), false);
  assert.equal(tutorial.perform('draw', 'side'), true);
  assert.equal(tutorial.current().id, 'complete');
  assert.equal(tutorial.perform('continue'), true);
  assert.equal(tutorial.active, false);
  assert.equal(tutorial.isCompleted(), true);
});

test('skip persists and replay clears completion before restarting', () => {
  const storage = memoryStorage();
  const tutorial = new TutorialController(storage);
  tutorial.start();
  tutorial.skip();
  assert.equal(tutorial.isCompleted(), true);
  assert.equal(tutorial.active, false);

  tutorial.replay();
  assert.equal(tutorial.isCompleted(), false);
  assert.equal(tutorial.active, true);
  assert.equal(tutorial.current().id, TUTORIAL_STEPS[0].id);
});
