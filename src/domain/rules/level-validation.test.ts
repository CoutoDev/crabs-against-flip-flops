import { describe, expect, it } from 'vitest';
import type { CrabType } from '../entities/crab';
import type { LevelConfig } from '../entities/level';
import { makeLevel, TEST_CRAB_SPECS } from '../test-support';
import { assertValidLevel, maxPossibleScore, validateLevel } from './level-validation';

const problemsOf = (level: LevelConfig) => validateLevel(level, TEST_CRAB_SPECS).join('\n');
const base = makeLevel();
const entry = { type: 'common' as const, weight: 1, speedPxPerSec: { min: 20, max: 40 } };

describe('validateLevel', () => {
  it('accepts a sane level', () => {
    expect(validateLevel(base, TEST_CRAB_SPECS)).toEqual([]);
  });

  it.each<[string, Partial<LevelConfig>, RegExp]>([
    ['no ammo', { ammo: 0 }, /ammo must/],
    ['fractional ammo', { ammo: 2.5 }, /ammo must/],
    ['no target', { targetScore: 0 }, /targetScore must/],
    ['no crab entries', { crabs: [] }, /crabs must not be empty/],
    [
      'inverted spawn interval',
      { spawn: { ...base.spawn, intervalMs: { min: 900, max: 100 } } },
      /spawn\.intervalMs/,
    ],
    [
      'lane outside the field',
      { spawn: { ...base.spawn, laneY: { min: 100, max: 200 } } },
      /spawn\.laneY/,
    ],
    ['zero on-screen cap', { spawn: { ...base.spawn, maxOnScreen: 0 } }, /spawn\.maxOnScreen/],
    [
      'unknown crab type',
      { crabs: [{ ...entry, type: 'ghost' as unknown as CrabType }] },
      /has no spec/,
    ],
    ['zero weight', { crabs: [{ ...entry, weight: 0 }] }, /crabs\[0\]\.weight/],
    [
      'inverted crab speed',
      { crabs: [{ ...entry, speedPxPerSec: { min: 50, max: 10 } }] },
      /crabs\[0\]\.speedPxPerSec/,
    ],
    ['zero throw speed', { throw: { ...base.throw, speedPxPerSec: 0 } }, /throw\.speedPxPerSec/],
    [
      'inverted flight times',
      { throw: { ...base.throw, minFlightMs: 900, maxFlightMs: 100 } },
      /throw\.minFlightMs/,
    ],
    ['zero combo step', { scoring: { ...base.scoring, comboStep: 0 } }, /scoring\.comboStep/],
    [
      'zero milestone interval',
      { scoring: { ...base.scoring, milestoneEvery: 0 } },
      /scoring\.milestoneEvery/,
    ],
    ['unreachable target', { ammo: 1, targetScore: 1000 }, /unreachable/],
  ])('rejects %s', (_name, overrides, expected) => {
    expect(problemsOf(makeLevel(overrides))).toMatch(expected);
  });

  it('reports every problem at once', () => {
    const problems = validateLevel(makeLevel({ ammo: 0, targetScore: 0 }), TEST_CRAB_SPECS);
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });
});

describe('maxPossibleScore', () => {
  it('assumes a perfect streak on the most valuable crab', () => {
    // 4 throws, step 3, cap 4: multipliers 1,1,1,2 → 10 * 5
    expect(maxPossibleScore(makeLevel({ ammo: 4 }), TEST_CRAB_SPECS)).toBe(50);
    const fiddlers = makeLevel({ ammo: 4, crabs: [{ ...entry, type: 'fiddler' }] });
    expect(maxPossibleScore(fiddlers, TEST_CRAB_SPECS)).toBe(150);
  });
});

describe('assertValidLevel', () => {
  it('does nothing for a valid level', () => {
    expect(() => assertValidLevel(base, TEST_CRAB_SPECS)).not.toThrow();
  });

  it('throws naming the level and the problems', () => {
    expect(() => assertValidLevel(makeLevel({ id: 7, ammo: 0 }), TEST_CRAB_SPECS)).toThrow(
      /Invalid level 7[\s\S]*ammo/,
    );
  });
});
