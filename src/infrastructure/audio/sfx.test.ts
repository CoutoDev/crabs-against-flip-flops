import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../../domain/events';
import { COMBO_LADDER_SEMITONES, comboSemitones, sfxForEvent } from './sfx-for-event';
import { SFX_IDS, SFX_SPECS, sfxEndMs } from './sfx-specs';

const hit = (combo: number): DomainEvent => ({
  type: 'CrabHit',
  crabId: 1,
  crabType: 'common',
  position: { x: 0, y: 0 },
  basePoints: 10,
  multiplier: 1,
  points: 10,
  combo,
  score: 10,
});

describe('sfxForEvent', () => {
  it('maps each gameplay event to its sound', () => {
    const origin = { x: 0, y: 0 };
    expect(
      sfxForEvent({ type: 'SlipperThrown', flightId: 1, target: origin, durationMs: 400 }),
    ).toEqual({ id: 'throw', semitones: 0 });
    expect(
      sfxForEvent({ type: 'SlipperMissed', flightId: 1, position: origin, lostCombo: 0 }),
    ).toEqual({
      id: 'miss',
      semitones: 0,
    });
    expect(sfxForEvent({ type: 'ScoreMilestone', milestone: 50, score: 50 })?.id).toBe('milestone');
    expect(sfxForEvent({ type: 'LevelCleared', score: 100, ammoLeft: 3 })?.id).toBe('win');
    expect(sfxForEvent({ type: 'RoundLost', score: 20 })?.id).toBe('lose');
  });

  it('buzzes when out of ammo but stays silent once the round is over', () => {
    expect(sfxForEvent({ type: 'ThrowRejected', reason: 'no_ammo' })?.id).toBe('rejected');
    expect(sfxForEvent({ type: 'ThrowRejected', reason: 'round_over' })).toBeUndefined();
  });

  it('climbs the pentatonic ladder as the combo grows, and stops climbing at the top', () => {
    const pitches = [1, 2, 3, 4, 5, 6, 7, 20].map((combo) => sfxForEvent(hit(combo))?.semitones);
    expect(pitches).toEqual([0, 2, 4, 7, 9, 12, 12, 12]);
    expect(comboSemitones(0)).toBe(0); // defensive: combo is never 0 on a hit, but must not crash
    expect(COMBO_LADDER_SEMITONES).toEqual([0, 2, 4, 7, 9, 12]);
  });
});

describe('sfx specs', () => {
  it('defines a spec for every id, each with at least one valid tone', () => {
    for (const id of SFX_IDS) {
      const spec = SFX_SPECS[id];
      expect(spec.steps.length, id).toBeGreaterThan(0);
      for (const step of spec.steps) {
        expect(step.durationMs, id).toBeGreaterThan(0);
        expect(step.startMs, id).toBeGreaterThanOrEqual(0);
        expect(step.gain, id).toBeGreaterThan(0);
        expect(step.gain, id).toBeLessThanOrEqual(1);
        if (step.wave !== 'noise') expect(step.freqHz, id).toBeGreaterThan(0);
      }
    }
  });

  it('keeps sounds short enough to stay responsive (except the end jingles)', () => {
    for (const id of ['throw', 'hit', 'miss', 'rejected', 'click'] as const) {
      expect(sfxEndMs(SFX_SPECS[id]), id).toBeLessThanOrEqual(200);
    }
  });

  it('sequences a hit, its milestone chime and the win jingle instead of stacking them', () => {
    // On the winning throw the same tick emits CrabHit, ScoreMilestone and LevelCleared.
    const hitEnd = sfxEndMs(SFX_SPECS.hit);
    const milestone = SFX_SPECS.milestone;
    const win = SFX_SPECS.win;
    expect(milestone.delayMs).toBeGreaterThanOrEqual(hitEnd - 60); // chime starts as the hit's tail ends
    expect(win.delayMs).toBeGreaterThanOrEqual(sfxEndMs(milestone));
  });

  it('lets the last miss finish before the losing jingle starts', () => {
    expect(SFX_SPECS.lose.delayMs).toBeGreaterThanOrEqual(sfxEndMs(SFX_SPECS.miss));
  });
});
