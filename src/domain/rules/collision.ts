import type { Crab, CrabSpecs } from '../entities/crab';
import { distance, type Vec2 } from '../geometry';

/**
 * The crab hit by a flip flop landing at `landing`: the nearest one whose reach
 * (its hit radius + the flip flop's radius) covers the landing point. Ties go to the lowest id.
 * One flip flop hits at most one crab.
 */
export function findHitCrab(
  landing: Vec2,
  crabs: readonly Crab[],
  specs: CrabSpecs,
  slipperRadiusPx: number,
): Crab | undefined {
  let best: Crab | undefined;
  let bestDistance = Infinity;
  for (const crab of crabs) {
    const d = distance(landing, crab);
    if (d > specs[crab.type].hitRadiusPx + slipperRadiusPx) continue;
    if (d < bestDistance || (d === bestDistance && best !== undefined && crab.id < best.id)) {
      best = crab;
      bestDistance = d;
    }
  }
  return best;
}
