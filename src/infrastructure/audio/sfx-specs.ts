/**
 * Every sound is a few synthesized tones (square / triangle / noise), like old console chips.
 * Specs are plain data, so they can be tested and tuned without a browser.
 */
export type Wave = 'square' | 'triangle' | 'noise';

export interface ToneStep {
  readonly wave: Wave;
  /** Offset from the start of the sound. */
  readonly startMs: number;
  readonly durationMs: number;
  /** Start frequency; ignored by noise. */
  readonly freqHz?: number;
  /** When set, the pitch slides linearly from freqHz to this value. */
  readonly endFreqHz?: number;
  /** 0..1, before the master volume. */
  readonly gain: number;
}

export interface SfxSpec {
  /** Waits this long before starting, so simultaneous events line up as a sequence, not a blur. */
  readonly delayMs: number;
  readonly steps: readonly ToneStep[];
}

export const SFX_IDS = [
  'throw',
  'hit',
  'miss',
  'milestone',
  'win',
  'lose',
  'rejected',
  'click',
] as const;
export type SfxId = (typeof SFX_IDS)[number];

const note = (startMs: number, durationMs: number, freqHz: number, gain = 0.3): ToneStep => ({
  wave: 'square',
  startMs,
  durationMs,
  freqHz,
  gain,
});

// Pitches used by the jingles (Hz): C5 E5 G5 C6 and a falling minor line for the loss.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const SFX_SPECS: Readonly<Record<SfxId, SfxSpec>> = {
  throw: {
    delayMs: 0,
    steps: [
      { wave: 'square', startMs: 0, durationMs: 110, freqHz: 420, endFreqHz: 180, gain: 0.18 },
    ],
  },
  // Pitch is raised per combo step by the player (see sfx-for-event).
  hit: {
    delayMs: 0,
    steps: [
      { wave: 'noise', startMs: 0, durationMs: 35, gain: 0.25 },
      note(0, 60, 660),
      note(60, 100, 990),
    ],
  },
  miss: {
    delayMs: 0,
    steps: [
      { wave: 'triangle', startMs: 0, durationMs: 150, freqHz: 220, endFreqHz: 110, gain: 0.35 },
      { wave: 'noise', startMs: 0, durationMs: 40, gain: 0.1 },
    ],
  },
  milestone: {
    delayMs: 110,
    steps: [note(0, 70, C5), note(70, 70, E5), note(140, 70, G5), note(210, 140, C6)],
  },
  win: {
    delayMs: 470,
    steps: [
      note(0, 90, C5),
      note(90, 90, E5),
      note(180, 90, G5),
      note(270, 90, C6),
      note(360, 90, G5),
      note(450, 320, C6),
    ],
  },
  lose: {
    delayMs: 180,
    steps: [
      { wave: 'triangle', startMs: 0, durationMs: 140, freqHz: 392, gain: 0.35 },
      { wave: 'triangle', startMs: 140, durationMs: 140, freqHz: 349.23, gain: 0.35 },
      { wave: 'triangle', startMs: 280, durationMs: 140, freqHz: 311.13, gain: 0.35 },
      { wave: 'triangle', startMs: 420, durationMs: 360, freqHz: 261.63, gain: 0.35 },
    ],
  },
  rejected: {
    delayMs: 0,
    steps: [note(0, 80, 150, 0.2)],
  },
  click: {
    delayMs: 0,
    steps: [note(0, 30, 880, 0.15)],
  },
};

/** Time from the request until the last tone ends. */
export function sfxEndMs(spec: SfxSpec): number {
  return spec.delayMs + Math.max(...spec.steps.map((step) => step.startMs + step.durationMs));
}
