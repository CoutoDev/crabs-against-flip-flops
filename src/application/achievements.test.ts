import { describe, expect, it } from 'vitest';
import {
  evaluateAchievements,
  isMet,
  progressOf,
  type AchievementCatalog,
  type AchievementContext,
  type Condition,
} from './achievements';
import { emptyStats, type PlayerStats } from './save-data';

const LEVELS: AchievementContext['levels'] = [
  { id: 1, biome: 'beach' },
  { id: 2, biome: 'beach' },
  { id: 3, biome: 'rocks' },
];

const context = (
  stats: Partial<PlayerStats> = {},
  clearedLevels: readonly number[] = [],
): AchievementContext => ({ stats: { ...emptyStats(), ...stats }, clearedLevels, levels: LEVELS });

describe('progressOf', () => {
  it.each<[string, Condition, Partial<PlayerStats>, number, number]>([
    ['hits', { kind: 'hits', atLeast: 10 }, { hits: 4 }, 4, 10],
    ['combo', { kind: 'combo', atLeast: 4 }, { bestCombo: 3 }, 3, 4],
    ['wins', { kind: 'wins', atLeast: 50 }, { wins: 7 }, 7, 50],
    ['totalPoints', { kind: 'totalPoints', atLeast: 10_000 }, { totalPoints: 900 }, 900, 10_000],
    [
      'crabHits counts only that crab',
      { kind: 'crabHits', crab: 'fiddler', atLeast: 25 },
      { hitsByType: { common: 90, swimmer: 40, fiddler: 6 } },
      6,
      25,
    ],
    ['flawlessWin', { kind: 'flawlessWin' }, { flawlessWins: 0 }, 0, 1],
    ['winWithAmmo', { kind: 'winWithAmmo', atLeast: 5 }, { bestAmmoLeftOnWin: 2 }, 2, 5],
  ])('%s', (_name, condition, stats, current, goal) => {
    expect(progressOf(condition, context(stats))).toEqual({ current, goal });
  });

  it('never reports more than the goal', () => {
    expect(progressOf({ kind: 'hits', atLeast: 10 }, context({ hits: 500 }))).toEqual({
      current: 10,
      goal: 10,
    });
    expect(progressOf({ kind: 'flawlessWin' }, context({ flawlessWins: 4 }))).toEqual({
      current: 1,
      goal: 1,
    });
  });

  it('counts the levels of a biome that were won', () => {
    const beach: Condition = { kind: 'biomeCleared', biome: 'beach' };
    expect(progressOf(beach, context({}, [1, 3]))).toEqual({ current: 1, goal: 2 });
    expect(progressOf(beach, context({}, [1, 2]))).toEqual({ current: 2, goal: 2 });
  });

  it('counts the levels of the whole campaign that were won', () => {
    expect(progressOf({ kind: 'campaignCleared' }, context({}, [1, 2]))).toEqual({
      current: 2,
      goal: 3,
    });
  });
});

describe('isMet', () => {
  it('is met exactly when the goal is reached', () => {
    const condition: Condition = { kind: 'combo', atLeast: 4 };
    expect(isMet(condition, context({ bestCombo: 3 }))).toBe(false);
    expect(isMet(condition, context({ bestCombo: 4 }))).toBe(true);
  });

  it('is never met for a biome with no levels', () => {
    expect(isMet({ kind: 'biomeCleared', biome: 'night' }, context({}, [1, 2, 3]))).toBe(false);
  });

  it('is met by the whole campaign only when every level was won', () => {
    expect(isMet({ kind: 'campaignCleared' }, context({}, [1, 2]))).toBe(false);
    expect(isMet({ kind: 'campaignCleared' }, context({}, [1, 2, 3]))).toBe(true);
  });
});

describe('evaluateAchievements', () => {
  const catalog: AchievementCatalog = [
    { id: 'a', condition: { kind: 'hits', atLeast: 1 }, coins: 5 },
    { id: 'b', condition: { kind: 'combo', atLeast: 4 } },
    { id: 'c', condition: { kind: 'wins', atLeast: 1 } },
  ];

  it('returns the ones just met, in catalog order', () => {
    expect(evaluateAchievements(catalog, context({ hits: 3, wins: 1 }), [])).toEqual(['a', 'c']);
  });

  it('does not return what was already earned, even if it would still be met', () => {
    expect(evaluateAchievements(catalog, context({ hits: 3, wins: 1 }), ['a'])).toEqual(['c']);
  });

  it('keeps an earned achievement out of the result when its condition no longer holds', () => {
    expect(evaluateAchievements(catalog, context(), ['b'])).toEqual([]);
  });

  it('returns nothing when nothing is met', () => {
    expect(evaluateAchievements(catalog, context(), [])).toEqual([]);
  });
});
