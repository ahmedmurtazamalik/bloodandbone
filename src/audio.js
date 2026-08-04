const SETTINGS_KEY = 'bb_audio_settings';
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

export const OST_TRACK = Object.freeze({
  title: 'The Hamlet',
  game: 'Darkest Dungeon',
  artist: 'Stuart Chatwood',
  src: 'artifacts/hamlet.mp3',
});

export const AUDIO_CUES = Object.freeze({
  ui: Object.freeze({ kind: 'tap', gain: .18 }),
  draw: Object.freeze({ kind: 'paper', gain: .28 }),
  select: Object.freeze({ kind: 'card', gain: .2 }),
  place: Object.freeze({ kind: 'thud', gain: .38 }),
  sacrifice: Object.freeze({ kind: 'ritual', gain: .46 }),
  boneGain: Object.freeze({ kind: 'bone', gain: .3 }),
  boneSpend: Object.freeze({ kind: 'rattle', gain: .34 }),
  bell: Object.freeze({ kind: 'brass', gain: .48 }),
  hit: Object.freeze({ kind: 'impact', gain: .38 }),
  direct: Object.freeze({ kind: 'slam', gain: .45 }),
  scale: Object.freeze({ kind: 'metal', gain: .28 }),
  reward: Object.freeze({ kind: 'chime', gain: .34 }),
  defeat: Object.freeze({ kind: 'fall', gain: .42 }),
  victory: Object.freeze({ kind: 'rise', gain: .4 }),
  invalid: Object.freeze({ kind: 'knock', gain: .22 }),
});

const voice = (kind, pitch, duration) => Object.freeze({ kind, pitch, duration });
export const CREATURE_VOICES = Object.freeze({
  squirrel: voice('chitter', 920, .28), rabbit: voice('squeak', 720, .22), bee: voice('buzz', 270, .42),
  stoat: voice('bark', 330, .3), bullfrog: voice('croak', 105, .55), wolfCub: voice('bark', 420, .34),
  sparrow: voice('chirp', 1180, .35), kingfisher: voice('chirp', 1450, .3), cat: voice('purr', 95, .58),
  blackGoat: voice('bleat', 230, .62), warren: voice('rustle', 560, .32), beehive: voice('buzz', 190, .7),
  mantis: voice('click', 680, .28), porcupine: voice('rustle', 440, .3), skunk: voice('hiss', 620, .45),
  wolf: voice('growl', 105, .72), riverSnapper: voice('croak', 74, .48), raven: voice('shriek', 620, .48),
  elk: voice('hoof', 92, .42), beaver: voice('chitter', 510, .3), adder: voice('hiss', 920, .56),
  fieldMice: voice('squeak', 1050, .38), grizzly: voice('growl', 58, 1.05), mooseBuck: voice('hoof', 64, .62),
  opossum: voice('hiss', 760, .38), coyote: voice('bark', 235, .62), cockroach: voice('click', 840, .42),
  corpseMaggots: voice('rustle', 310, .5), rattler: voice('hiss', 1120, .72), turkeyVulture: voice('shriek', 410, .62),
  mantisGod: voice('drone', 160, .9), ouroboros: voice('drone', 82, 1.2),
});

export class AudioSettings {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(SETTINGS_KEY) || '{}'); } catch { saved = {}; }
    this.musicVolume = clamp(saved.musicVolume ?? .42);
    this.sfxVolume = clamp(saved.sfxVolume ?? .72);
    this.muted = Boolean(saved.muted);
  }

  persist() {
    try { this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.snapshot())); } catch { /* storage is optional */ }
  }

  setMusicVolume(value) { this.musicVolume = clamp(value); this.persist(); return this.musicVolume; }
  setSfxVolume(value) { this.sfxVolume = clamp(value); this.persist(); return this.sfxVolume; }
  setMuted(value) { this.muted = Boolean(value); this.persist(); return this.muted; }
  snapshot() { return { musicVolume: this.musicVolume, sfxVolume: this.sfxVolume, muted: this.muted }; }
}

export class AudioDirector {
  constructor({ storage = globalThis.localStorage, AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, AudioClass = globalThis.Audio } = {}) {
    this.settings = new AudioSettings(storage);
    this.AudioContextClass = AudioContextClass;
    this.AudioClass = AudioClass;
    this.context = null;
    this.master = null;
    this.music = null;
    this.musicFade = null;
    this.cueCount = 0;
  }

  unlock() {
    try {
      if (!this.context && this.AudioContextClass) {
        this.context = new this.AudioContextClass();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      if (this.context?.state === 'suspended') this.context.resume();
      this.sync();
      return Boolean(this.context);
    } catch { return false; }
  }

  sync() {
    if (this.master && this.context) {
      const value = this.settings.muted ? 0 : this.settings.sfxVolume;
      this.master.gain.setTargetAtTime(value, this.context.currentTime, .015);
    }
    if (this.music) this.music.volume = this.settings.muted ? 0 : clamp(this.settings.musicVolume * .72);
  }

  setMusicVolume(value) { this.settings.setMusicVolume(value); this.sync(); }
  setSfxVolume(value) { this.settings.setSfxVolume(value); this.sync(); }
  toggleMute() { this.settings.setMuted(!this.settings.muted); this.sync(); return this.settings.muted; }

  tone(frequency, duration, { type = 'sine', gain = .2, delay = 0, end = frequency } = {}) {
    if (!this.unlock() || !this.context || !this.master) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), now + Math.min(.018, duration * .2));
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(now); oscillator.stop(now + duration + .02);
  }

  noise(duration, { gain = .16, frequency = 900, delay = 0, type = 'bandpass' } = {}) {
    if (!this.unlock() || !this.context || !this.master) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = .8;
    const now = this.context.currentTime + delay;
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), now + .01);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.buffer = buffer; source.connect(filter).connect(envelope).connect(this.master);
    source.start(now); source.stop(now + duration + .02);
  }

  playCue(name, intensity = 1) {
    const cue = AUDIO_CUES[name];
    if (!cue || this.settings.muted) return false;
    this.cueCount += 1;
    const gain = cue.gain * Math.max(.35, Math.min(1.4, intensity));
    switch (cue.kind) {
      case 'tap': this.tone(430, .055, { type: 'triangle', gain }); break;
      case 'paper': this.noise(.13, { gain: gain * .8, frequency: 1450 }); this.tone(180, .08, { type: 'triangle', gain: gain * .28, delay: .05, end: 120 }); break;
      case 'card': this.noise(.06, { gain: gain * .65, frequency: 1900 }); this.tone(540, .05, { gain: gain * .35 }); break;
      case 'thud': this.tone(135, .17, { type: 'triangle', gain, end: 46 }); this.noise(.07, { gain: gain * .55, frequency: 420 }); break;
      case 'ritual': this.tone(88, .42, { type: 'sawtooth', gain, end: 38 }); this.noise(.3, { gain: gain * .45, frequency: 620 }); break;
      case 'bone': this.tone(1180, .08, { type: 'triangle', gain }); this.tone(1630, .11, { type: 'sine', gain: gain * .55, delay: .045 }); break;
      case 'rattle': for (let i = 0; i < 4; i += 1) this.tone(850 + i * 130, .045, { type: 'triangle', gain: gain * .55, delay: i * .035 }); break;
      case 'brass': [620, 930, 1240, 1860].forEach((pitch, index) => this.tone(pitch, .9 + index * .08, { gain: gain / (index + 1), delay: index * .008, end: pitch * .985 })); break;
      case 'impact': this.noise(.09, { gain, frequency: 280, type: 'lowpass' }); this.tone(105, .13, { type: 'triangle', gain: gain * .8, end: 45 }); break;
      case 'slam': this.tone(74, .28, { type: 'sawtooth', gain, end: 31 }); this.noise(.16, { gain: gain * .65, frequency: 190, type: 'lowpass' }); break;
      case 'metal': this.tone(1310, .18, { type: 'triangle', gain }); this.tone(1980, .24, { gain: gain * .4, delay: .025 }); break;
      case 'chime': [392, 523, 659].forEach((pitch, index) => this.tone(pitch, .34, { gain: gain * .8, delay: index * .07 })); break;
      case 'fall': [196, 155, 116].forEach((pitch, index) => this.tone(pitch, .48, { type: 'sawtooth', gain: gain * .65, delay: index * .13, end: pitch * .7 })); break;
      case 'rise': [262, 330, 392, 523].forEach((pitch, index) => this.tone(pitch, .55, { type: 'triangle', gain: gain * .7, delay: index * .11 })); break;
      case 'knock': this.tone(83, .08, { type: 'square', gain, end: 70 }); break;
    }
    return true;
  }

  playCreature(key) {
    const profile = CREATURE_VOICES[key];
    if (!profile || this.settings.muted) return false;
    this.cueCount += 1;
    const { kind, pitch, duration } = profile;
    switch (kind) {
      case 'chitter': case 'squeak': for (let i = 0; i < 3; i += 1) this.tone(pitch * (1 + i * .08), duration / 3, { type: 'triangle', gain: .16, delay: i * duration / 4, end: pitch * 1.12 }); break;
      case 'chirp': for (let i = 0; i < 3; i += 1) this.tone(pitch * (1 - i * .06), duration / 3, { gain: .15, delay: i * duration / 3, end: pitch * 1.28 }); break;
      case 'buzz': this.tone(pitch, duration, { type: 'sawtooth', gain: .1, end: pitch * 1.05 }); this.tone(pitch * 1.035, duration, { type: 'square', gain: .055 }); break;
      case 'bark': this.tone(pitch, duration * .42, { type: 'sawtooth', gain: .22, end: pitch * .55 }); this.noise(duration * .3, { gain: .08, frequency: pitch * 2 }); break;
      case 'croak': this.tone(pitch, duration, { type: 'square', gain: .15, end: pitch * .63 }); this.tone(pitch * 1.5, duration * .55, { type: 'triangle', gain: .07 }); break;
      case 'purr': this.tone(pitch, duration, { type: 'sawtooth', gain: .07, end: pitch * .96 }); this.tone(pitch * 2, duration, { type: 'triangle', gain: .05 }); break;
      case 'bleat': this.tone(pitch, duration, { type: 'sawtooth', gain: .15, end: pitch * 1.34 }); this.tone(pitch * 1.03, duration * .85, { type: 'square', gain: .04 }); break;
      case 'rustle': this.noise(duration, { gain: .12, frequency: pitch, type: 'highpass' }); break;
      case 'click': for (let i = 0; i < 5; i += 1) this.tone(pitch + i * 90, .025, { type: 'square', gain: .12, delay: i * duration / 6 }); break;
      case 'growl': this.tone(pitch, duration, { type: 'sawtooth', gain: .19, end: pitch * .72 }); this.noise(duration * .8, { gain: .1, frequency: pitch * 2.4, type: 'lowpass' }); break;
      case 'hiss': this.noise(duration, { gain: .14, frequency: pitch, type: 'highpass' }); break;
      case 'hoof': this.tone(pitch, .1, { type: 'triangle', gain: .24, end: 38 }); this.tone(pitch * .86, .12, { type: 'triangle', gain: .2, delay: duration * .42, end: 35 }); break;
      case 'shriek': this.tone(pitch, duration, { type: 'sawtooth', gain: .13, end: pitch * 1.75 }); this.noise(duration * .7, { gain: .055, frequency: pitch * 2 }); break;
      case 'drone': this.tone(pitch, duration, { type: 'sawtooth', gain: .1, end: pitch * .75 }); this.tone(pitch * 1.5, duration, { type: 'triangle', gain: .07, end: pitch * 1.02 }); break;
    }
    return true;
  }

  async startMusic() {
    if (!OST_TRACK.src || !this.AudioClass) return false;
    if (!this.music) {
      this.music = new this.AudioClass(OST_TRACK.src);
      this.music.loop = true;
      this.music.preload = 'auto';
    }
    this.sync();
    try { await this.music.play(); return true; } catch { return false; }
  }

  fadeMusic(target, duration = 800) {
    if (!this.music) return;
    clearInterval(this.musicFade);
    const start = this.music.volume;
    const finish = clamp(target);
    const began = performance.now();
    this.musicFade = setInterval(() => {
      const progress = Math.min(1, (performance.now() - began) / duration);
      this.music.volume = clamp(start + (finish - start) * progress);
      if (progress >= 1) clearInterval(this.musicFade);
    }, 32);
  }

  snapshot() {
    return { ...this.settings.snapshot(), unlocked: Boolean(this.context), contextState: this.context?.state || 'unavailable', cueCount: this.cueCount, musicConfigured: Boolean(OST_TRACK.src), musicPlaying: Boolean(this.music && !this.music.paused), musicSrc: this.music?.currentSrc || this.music?.src || null };
  }
}
