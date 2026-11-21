import type { CrabSpecs } from '../domain/entities/crab';

/**
 * Initial balance proposal (tune during playtesting, M2).
 * Hit radius is the crab's "reach" in field pixels; the flip flop adds SLIPPER_RADIUS_PX on top.
 * Smaller and faster crabs are worth more.
 */
export const CRAB_TYPES: CrabSpecs = {
  common: { points: 10, hitRadiusPx: 9 },
  swimmer: { points: 20, hitRadiusPx: 8 },
  fiddler: { points: 30, hitRadiusPx: 6 },
};
