import type { LevelConfig, ScoringConfig } from '../domain/entities/level';

const DEFAULT_SCORING: ScoringConfig = {
  comboStep: 3,
  maxMultiplier: 4,
  milestoneEvery: 100,
};

/**
 * Level 1 — beach. Only common crabs, slow, forgiving. The milestone is lowered to 50 so the
 * first "score jingle" happens early, since a 100-point target would clear the level right on it.
 * The campaign (M3) will add the remaining levels and biomes here.
 */
const LEVEL_1: LevelConfig = {
  id: 1,
  biome: 'beach',
  ammo: 16,
  targetScore: 100,
  spawn: {
    intervalMs: { min: 900, max: 1600 },
    maxOnScreen: 4,
    laneY: { min: 80, max: 150 },
  },
  crabs: [{ type: 'common', weight: 1, speedPxPerSec: { min: 20, max: 40 } }],
  throw: { speedPxPerSec: 240, minFlightMs: 350, maxFlightMs: 800, arcHeightPx: 40 },
  scoring: { ...DEFAULT_SCORING, milestoneEvery: 50 },
};

export const LEVELS: readonly LevelConfig[] = [LEVEL_1];
