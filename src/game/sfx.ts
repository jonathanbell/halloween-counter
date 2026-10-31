// Every sound is synthesized with Web Audio, so there are no files to load.
// Sound is decoration only: a muted phone, a blocked AudioContext or a
// browser without Web Audio plays the exact same game, silently.

type Wave = OscillatorType;

interface Tone {
  wave: Wave;
  from: number; // Hz
  to?: number; // Hz, glides from `from`
  ms: number;
  gain?: number;
  delayMs?: number;
}

const DEFAULT_GAIN = 0.18;
const RAMP_FLOOR = 0.0001; // exponential ramps cannot reach 0

let ctx: AudioContext | null = null;

// Must run inside a tap handler: iOS only unlocks audio from a user gesture
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone({ wave, from, to, ms, gain = DEFAULT_GAIN, delayMs = 0 }: Tone): void {
  if (!ctx || ctx.state !== 'running') return;
  try {
    const start = ctx.currentTime + delayMs / 1000;
    const end = start + ms / 1000;

    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, end);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(RAMP_FLOOR, end);

    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
  } catch {
    // Never let a sound break a bonk
  }
}

function noise(ms: number, gain: number, lowpassHz: number): void {
  if (!ctx || ctx.state !== 'running') return;
  try {
    const length = Math.floor(ctx.sampleRate * (ms / 1000));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassHz;
    const amp = ctx.createGain();
    amp.gain.value = gain;

    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start();
  } catch {
    // Same as tone(): silence is an acceptable failure
  }
}

export const sfx = {
  // A character springs out of its grave
  boing: () => tone({ wave: 'triangle', from: 220, to: 660, ms: 180, gain: 0.08 }),

  bonk: () => {
    tone({ wave: 'sine', from: 520, to: 120, ms: 140, gain: 0.3 });
    noise(60, 0.25, 1800);
  },

  ding: () => {
    tone({ wave: 'sine', from: 1320, ms: 600, gain: 0.15 });
    tone({ wave: 'sine', from: 1760, ms: 600, gain: 0.1, delayMs: 60 });
  },

  oof: () => {
    tone({ wave: 'sawtooth', from: 320, to: 110, ms: 260, gain: 0.12 });
    noise(120, 0.15, 600);
  },

  meow: () => {
    tone({ wave: 'sine', from: 700, to: 1100, ms: 160, gain: 0.16 });
    tone({ wave: 'sine', from: 1100, to: 560, ms: 220, gain: 0.16, delayMs: 160 });
  },

  hey: () => {
    tone({ wave: 'square', from: 380, to: 540, ms: 120, gain: 0.08 });
    tone({ wave: 'square', from: 540, to: 360, ms: 140, gain: 0.08, delayMs: 120 });
  },

  splat: () => noise(90, 0.18, 700),

  tick: () => tone({ wave: 'sine', from: 660, ms: 110, gain: 0.15 }),

  go: () => tone({ wave: 'sine', from: 990, ms: 260, gain: 0.2 }),

  buzzer: () => tone({ wave: 'sawtooth', from: 110, to: 90, ms: 650, gain: 0.15 }),
};

// Android buzzes; iOS Safari has no vibration API and simply skips it
export function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Unsupported, fine
  }
}
