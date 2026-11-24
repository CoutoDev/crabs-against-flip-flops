import type { CrabType } from '../domain/entities/crab';
import type { Biome } from '../domain/entities/level';
import type { PlayerStats } from './save-data';

/**
 * What an achievement asks for (ADR 10.3). Every condition reads only what the save keeps (the
 * lifetime counters and the levels already won), so the achievements screen can show progress for
 * all of them at any time, and a condition added later can be met by a player who did the work
 * before it existed (levels won), or from now on (counters).
 */
export type Condition =
  | { readonly kind: 'hits'; readonly atLeast: number }
  | { readonly kind: 'combo'; readonly atLeast: number }
  | { readonly kind: 'wins'; readonly atLeast: number }
  | { readonly kind: 'totalPoints'; readonly atLeast: number }
  | { readonly kind: 'crabHits'; readonly crab: CrabType; readonly atLeast: number }
  /** Win one round without a single missed throw. */
  | { readonly kind: 'flawlessWin' }
  /** Win one round with at least this many flip flops left over. */
  | { readonly kind: 'winWithAmmo'; readonly atLeast: number }
  | { readonly kind: 'biomeCleared'; readonly biome: Biome }
  | { readonly kind: 'campaignCleared' };

export interface AchievementDef {
  /** Texts are `achievements.<id>.name` and `achievements.<id>.hint` in the catalogs. */
  readonly id: string;
  readonly condition: Condition;
  /** Coins paid when it is earned. Items it unlocks are named by the items themselves (`acquire`). */
  readonly coins?: number;
}

export type AchievementCatalog = readonly AchievementDef[];

/** What the conditions look at. */
export interface AchievementContext {
  readonly stats: PlayerStats;
  /** Ids of the levels won at least once. */
  readonly clearedLevels: readonly number[];
  /** The campaign, to tell which levels belong to which biome. */
  readonly levels: readonly { readonly id: number; readonly biome: Biome }[];
}

/** How far along a condition is; `current` never goes past `goal`. */
export interface Progress {
  readonly current: number;
  readonly goal: number;
}

const capped = (current: number, goal: number): Progress => ({
  current: Math.min(current, goal),
  goal,
});

export function progressOf(condition: Condition, context: AchievementContext): Progress {
  const { stats, clearedLevels, levels } = context;
  switch (condition.kind) {
    case 'hits':
      return capped(stats.hits, condition.atLeast);
    case 'combo':
      return capped(stats.bestCombo, condition.atLeast);
    case 'wins':
      return capped(stats.wins, condition.atLeast);
    case 'totalPoints':
      return capped(stats.totalPoints, condition.atLeast);
    case 'crabHits':
      return capped(stats.hitsByType[condition.crab], condition.atLeast);
    case 'flawlessWin':
      return capped(stats.flawlessWins, 1);
    case 'winWithAmmo':
      return capped(stats.bestAmmoLeftOnWin, condition.atLeast);
    case 'biomeCleared': {
      const inBiome = levels.filter((level) => level.biome === condition.biome);
      const won = inBiome.filter((level) => clearedLevels.includes(level.id)).length;
      return capped(won, inBiome.length);
    }
    case 'campaignCleared': {
      const won = levels.filter((level) => clearedLevels.includes(level.id)).length;
      return capped(won, levels.length);
    }
  }
}

/** A condition with nothing to ask for (no levels in the biome) is never met. */
export function isMet(condition: Condition, context: AchievementContext): boolean {
  const { current, goal } = progressOf(condition, context);
  return goal > 0 && current >= goal;
}

/**
 * Pure: the ids earned now that were not earned before, in catalog order. Earning is permanent:
 * an id in `earned` stays out of the result even if its condition would no longer hold.
 */
export function evaluateAchievements(
  catalog: AchievementCatalog,
  context: AchievementContext,
  earned: readonly string[],
): readonly string[] {
  return catalog
    .filter((entry) => !earned.includes(entry.id) && isMet(entry.condition, context))
    .map((entry) => entry.id);
}
