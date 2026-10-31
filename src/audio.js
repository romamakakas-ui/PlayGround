/* Neon disco score + arcade SFX, synthesised live with WebAudio.
   No audio files, no network — just a tiny built-in band. */

const A = 55;
const note = (semitonesFromA1) => A * Math.pow(2, semitonesFromA1 / 12);
const BASS = [
  note(0), note(0), note(0), note(0),
  note(0), note(0), note(3), note(0),
  note(7), note(7), note(7), note(7),
  note(5), note(5), note(3), note(3),
];
const PAD_CHORDS = [
  [0, 3, 7, 12],
  [-4, 0, 3, 8],
  [3, 7, 10, 15],
  [-2, 2, 5, 10],
];
const ARP = [12, 15, 19, 24, 19, 15, 12, 19, 10, 14, 17, 22, 17, 14, 10, 14];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.filter = null;
    this.noiseBuffer = null;
    this.step = 0;
    this.nextTime = 0;
    this.playing = false;
    this.encore = false;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('kirkorov-run-muted') === '1';
    } catch { /* private mode */ }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2200;
    this.filter.Q.value = 0.6;

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.42;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;

    this.musicBus.connect(this.filter);
    this.filter.connect(comp);
    this.sfxBus.connect(comp);
    comp.connect(this.master);
    this.master.connect(ctx.destination);

    // One second of reusable white noise.
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    this.noiseBuffer = buffer;

    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('kirkorov-run-muted', muted ? '1' : '0'); } catch { /* ignore */ }
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.72, now, 0.04);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setEncore(on) {
    this.encore = on;
    if (!this.filter || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setTargetAtTime(on ? 6200 : 2200, now, 0.15);
  }

  startMusic() {
    if (!this.ctx) return;
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
  }

  stopMusic() {
    this.playing = false;
  }

  update() {
    if (!this.ctx || !this.playing) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') return;
    const sixteenth = 60 / 118 / 4;
    while (this.nextTime < ctx.currentTime + 0.14) {
      this.scheduleStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 64;
      this.nextTime += sixteenth;
    }
  }

  scheduleStep(stepIndex, time) {
    const s = stepIndex % 16;
    const bar = Math.floor(stepIndex / 16) % 4;
    const ctx = this.ctx;

    if (s % 4 === 0) this.kick(time, s === 0 ? 1 : 0.82);
    if (s === 4 || s === 12) this.clap(time);
    if (s % 2 === 1) this.hat(time, 0.16);
    if (s === 14) this.hat(time, 0.1, 0.18);
    if (this.encore && (s === 3 || s === 11)) this.hat(time, 0.07, 0.3);

    const bassNote = BASS[(stepIndex % 16)];
    if (s % 2 === 0) this.bass(time, bassNote, 0.18);

    if (s === 0) this.pad(time, PAD_CHORDS[bar]);
    if (s % 2 === 0) {
      const arpIndex = (stepIndex * 3) % ARP.length;
      this.pluck(time, note(ARP[arpIndex]), this.encore ? 0.06 : 0.035);
    }
  }

  kick(t, gain = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, t);
    osc.frequency.exponentialRampToValueAtTime(43, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  clap(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1650;
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.2);
  }

  hat(t, gain = 0.15, decay = 0.045) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(hp).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  bass(t, freq, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    sub.type = 'triangle';
    osc.frequency.value = freq;
    sub.frequency.value = freq;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(lp);
    sub.connect(lp);
    lp.connect(g).connect(this.musicBus);
    osc.start(t); osc.stop(t + 0.26);
    sub.start(t); sub.stop(t + 0.26);
  }

  pad(t, chord) {
    const ctx = this.ctx;
    const dur = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1250;
    chord.forEach((semi, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.value = note(semi + 12);
      osc.detune.value = (index - 1.5) * 6;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + dur);
    });
    lp.connect(g).connect(this.musicBus);
  }

  pluck(t, freq, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq * 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  blip(freq, duration = 0.08, type = 'triangle', gain = 0.14) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  coin(streak = 0) {
    if (!this.ctx) return;
    const base = 880 * Math.pow(2, Math.min(streak, 8) / 24);
    this.blip(base, 0.09, 'sine', 0.12);
    setTimeout(() => this.blip(base * 1.5, 0.12, 'sine', 0.09), 45);
  }

  jump() { this.blip(330, 0.12, 'square', 0.055); setTimeout(() => this.blip(520, 0.1, 'square', 0.04), 35); }
  slide() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(220, t + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.26);
  }

  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.36);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(lp).connect(ng).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.2);
  }

  encoreStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this.blip(440 * Math.pow(2, i / 4), 0.5, 'sine', 0.05);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(400, t);
    hp.frequency.exponentialRampToValueAtTime(5200, t + 0.8);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(hp).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.95);
  }

  gameOver() {
    if (!this.ctx) return;
    const notes = [440, 392, 349, 293, 220];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.32, 'triangle', 0.1), i * 120));
  }

  click() { this.blip(660, 0.05, 'square', 0.035); }
}
