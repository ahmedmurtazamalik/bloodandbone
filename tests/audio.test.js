import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_LIBRARY } from '../src/cards.js';
import { AUDIO_CUES, CREATURE_VOICES, AudioSettings, OST_TRACK } from '../src/audio.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('audio settings clamp and persist independent music and effects levels', () => {
  const storage = memoryStorage();
  const settings = new AudioSettings(storage);
  settings.setMusicVolume(2);
  settings.setSfxVolume(-1);
  settings.setMuted(true);

  assert.equal(settings.musicVolume, 1);
  assert.equal(settings.sfxVolume, 0);
  assert.equal(settings.muted, true);

  const restored = new AudioSettings(storage);
  assert.deepEqual(restored.snapshot(), { musicVolume: 1, sfxVolume: 0, muted: true });
});

test('every card template has a deliberate synthesized creature voice', () => {
  assert.deepEqual(Object.keys(CREATURE_VOICES).sort(), Object.keys(CARD_LIBRARY).sort());
  for (const [key, voice] of Object.entries(CREATURE_VOICES)) {
    assert.match(voice.kind, /^(chitter|chirp|buzz|bark|croak|purr|bleat|rustle|click|growl|hiss|hoof|squeak|shriek|drone)$/);
    assert.ok(voice.pitch >= 40 && voice.pitch <= 1800, `${key} pitch out of range`);
    assert.ok(voice.duration >= 0.05 && voice.duration <= 1.8, `${key} duration out of range`);
  }
});

test('cue library covers tactile game events and binds the supplied soundtrack', () => {
  const required = ['ui','draw','select','place','sacrifice','boneGain','boneSpend','bell','hit','direct','scale','reward','defeat','victory','invalid'];
  assert.deepEqual(Object.keys(AUDIO_CUES).sort(), required.sort());
  assert.equal(OST_TRACK.title, 'The Hamlet');
  assert.equal(OST_TRACK.game, 'Darkest Dungeon');
  assert.equal(OST_TRACK.src, 'artifacts/hamlet.mp3');
});
