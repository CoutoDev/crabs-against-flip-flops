import type { Biome } from '../../domain/entities/level';

/**
 * Background music as data: one short loop per biome, written as MIDI note numbers on a grid of
 * 16th notes (0 = rest). Every melody sticks to a pentatonic scale over a simple bass, so any
 * note that lands together still sounds fine: a loop that plays for minutes must not grate.
 */
export interface MusicTrack {
  readonly bpm: number;
  /** One entry per 16th note; both lines have the same length (2 bars). */
  readonly lead: readonly number[];
  readonly bass: readonly number[];
  readonly leadWave: 'square' | 'triangle';
}

/** Steps (16ths) a note rings before its envelope closes: short and staccato, like a chip tune. */
export const LEAD_NOTE_STEPS = 1.6;
export const BASS_NOTE_STEPS = 3.2;
export const LEAD_GAIN = 0.1;
export const BASS_GAIN = 0.16;

export const MUSIC_TRACKS: Readonly<Record<Biome, MusicTrack>> = {
  // C major pentatonic, bright and bouncy.
  beach: {
    bpm: 112,
    leadWave: 'square',
    lead: [
      72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 76, 0, 0, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0, 76,
      0, 72, 0, 0, 0,
    ],
    bass: [
      48, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 43,
      0, 0, 0,
    ],
  },
  // A minor pentatonic, a little tougher.
  rocks: {
    bpm: 104,
    leadWave: 'square',
    lead: [
      69, 0, 72, 0, 74, 0, 72, 0, 76, 0, 74, 0, 72, 0, 0, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72,
      0, 69, 0, 0, 0,
    ],
    bass: [
      45, 0, 0, 0, 45, 0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 38, 0, 0, 0, 38, 0, 0, 0, 40, 0, 0, 0, 45,
      0, 0, 0,
    ],
  },
  // D minor pentatonic, slow and sparse: the swamp.
  mangrove: {
    bpm: 88,
    leadWave: 'triangle',
    lead: [
      74, 0, 0, 0, 77, 0, 0, 0, 79, 0, 0, 0, 77, 0, 74, 0, 81, 0, 0, 0, 79, 0, 0, 0, 77, 0, 74, 0,
      0, 0, 0, 0,
    ],
    bass: [
      38, 0, 0, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0,
      0, 0,
    ],
  },
  // E minor pentatonic with a steady pulse underneath: the night.
  night: {
    bpm: 100,
    leadWave: 'triangle',
    lead: [
      76, 0, 79, 0, 83, 0, 79, 0, 76, 0, 79, 0, 81, 0, 0, 0, 83, 0, 86, 0, 83, 0, 81, 0, 79, 0, 76,
      0, 0, 0, 0, 0,
    ],
    bass: [
      40, 0, 0, 40, 0, 0, 40, 0, 40, 0, 0, 40, 0, 0, 45, 0, 45, 0, 0, 45, 0, 0, 45, 0, 40, 0, 0, 40,
      0, 0, 47, 0,
    ],
  },
};

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Length of one 16th note in seconds. */
export const stepSeconds = (track: MusicTrack): number => 60 / track.bpm / 4;
