import type { ScoringConfig } from '../entities/level';

/**
 * Multiplier for the n-th consecutive hit (n >= 1): +1 every `comboStep` hits, capped.
 * With step 3 / max 4: hits 1-3 → x1, 4-6 → x2, 7-9 → x3, 10+ → x4.
 */
export function comboMultiplier(comboCount: number, config: ScoringConfig): number {
  if (!Number.isInteger(comboCount) || comboCount < 1) {
    throw new RangeError(`comboMultiplier: comboCount must be an integer >= 1, got ${comboCount}`);
  }
  return Math.min(config.maxMultiplier, 1 + Math.floor((comboCount - 1) / config.comboStep));
}

export function pointsForHit(
  basePoints: number,
  comboCount: number,
  config: ScoringConfig,
): number {
  return basePoints * comboMultiplier(comboCount, config);
}

/** Every multiple of `every` that the score passed going from `previous` to `next`, ascending. */
export function milestonesCrossed(previous: number, next: number, every: number): number[] {
  if (every <= 0 || next <= previous) return [];
  const crossed: number[] = [];
  for (let m = (Math.floor(previous / every) + 1) * every; m <= next; m += every) {
    crossed.push(m);
  }
  return crossed;
}
