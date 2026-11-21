import { describe, expect, it } from 'vitest';
import type { Biome } from '../../domain/entities/level';
import { midiToHz, MUSIC_TRACKS, stepSeconds } from './music-specs';

const BIOMES: readonly Biome[] = ['beach', 'rocks', 'mangrove', 'night'];

describe('music tracks', () => {
  it('has one track per biome', () => {
    expect(Object.keys(MUSIC_TRACKS).sort()).toEqual([...BIOMES].sort());
  });

  it.each(BIOMES)('%s: lead and bass cover the same two bars of 16ths', (biome) => {
    const track = MUSIC_TRACKS[biome];
    expect(track.lead).toHaveLength(32);
    expect(track.bass).toHaveLength(32);
  });

  it.each(BIOMES)('%s: notes are in a comfortable range and the loop is not empty', (biome) => {
    const { lead, bass } = MUSIC_TRACKS[biome];
    for (const midi of lead.filter((note) => note > 0)) {
      expect(midi).toBeGreaterThanOrEqual(60);
      expect(midi).toBeLessThanOrEqual(90);
    }
    for (const midi of bass.filter((note) => note > 0)) {
      expect(midi).toBeGreaterThanOrEqual(30);
      expect(midi).toBeLessThanOrEqual(55);
    }
    expect(lead.some((note) => note > 0)).toBe(true);
    expect(bass.some((note) => note > 0)).toBe(true);
  });

  it('every biome sounds different', () => {
    const fingerprints = BIOMES.map((biome) => JSON.stringify(MUSIC_TRACKS[biome]));
    expect(new Set(fingerprints).size).toBe(BIOMES.length);
  });

  it('loops are the length of a calm tempo, not a rush', () => {
    for (const biome of BIOMES) {
      expect(MUSIC_TRACKS[biome].bpm).toBeGreaterThanOrEqual(80);
      expect(MUSIC_TRACKS[biome].bpm).toBeLessThanOrEqual(120);
    }
  });

  it('converts MIDI numbers to frequencies (A4 = 440 Hz)', () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(81)).toBeCloseTo(880);
    expect(midiToHz(60)).toBeCloseTo(261.63, 1);
  });

  it('a 16th note at 120 bpm lasts 125 ms', () => {
    expect(stepSeconds({ ...MUSIC_TRACKS.beach, bpm: 120 })).toBeCloseTo(0.125);
  });
});
