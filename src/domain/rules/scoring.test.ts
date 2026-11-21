import { describe, expect, it } from 'vitest';
import type { ScoringConfig } from '../entities/level';
import { comboMultiplier, milestonesCrossed, pointsForHit } from './scoring';

const config: ScoringConfig = { comboStep: 3, maxMultiplier: 4, milestoneEvery: 50 };

describe('comboMultiplier', () => {
  it.each([
    [1, 1],
    [3, 1],
    [4, 2],
    [6, 2],
    [7, 3],
    [10, 4],
    [13, 4],
    [100, 4],
  ])('hit #%i has multiplier x%i', (combo, expected) => {
    expect(comboMultiplier(combo, config)).toBe(expected);
  });

  it('raises the multiplier on every hit with a step of 1', () => {
    const fast = { ...config, comboStep: 1, maxMultiplier: 3 };
    expect([1, 2, 3, 4].map((n) => comboMultiplier(n, fast))).toEqual([1, 2, 3, 3]);
  });

  it('rejects combo counts below 1 or non-integers', () => {
    expect(() => comboMultiplier(0, config)).toThrow(RangeError);
    expect(() => comboMultiplier(1.5, config)).toThrow(RangeError);
  });
});

describe('pointsForHit', () => {
  it('multiplies the base points by the combo multiplier', () => {
    expect(pointsForHit(10, 1, config)).toBe(10);
    expect(pointsForHit(10, 4, config)).toBe(20);
    expect(pointsForHit(30, 10, config)).toBe(120);
  });
});

describe('milestonesCrossed', () => {
  it('returns nothing below the first milestone', () => {
    expect(milestonesCrossed(0, 49, 50)).toEqual([]);
  });

  it('includes a milestone that is hit exactly', () => {
    expect(milestonesCrossed(0, 50, 50)).toEqual([50]);
  });

  it('does not repeat a milestone already reached', () => {
    expect(milestonesCrossed(50, 60, 50)).toEqual([]);
    expect(milestonesCrossed(100, 100, 50)).toEqual([]);
  });

  it('returns every milestone crossed by a big jump, in order', () => {
    expect(milestonesCrossed(40, 160, 50)).toEqual([50, 100, 150]);
  });

  it('ignores a disabled interval and non-increasing scores', () => {
    expect(milestonesCrossed(0, 100, 0)).toEqual([]);
    expect(milestonesCrossed(60, 40, 50)).toEqual([]);
  });
});
