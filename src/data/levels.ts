import type { Biome, LevelConfig, ScoringConfig } from '../domain/entities/level';

/*
 * The campaign: 12 levels, three per biome (beach → rocks → mangrove → night).
 *
 * Difficulty rises along three axes, and the numbers below are measured by the balance
 * simulation (data/balance.test.ts), not guessed:
 *  - who shows up: only common crabs on the beach, then swimmers (faster, worth 20), then
 *    fiddlers (small hit box, worth 30);
 *  - how fast and how dense: walking speed, spawn interval and crabs on screen;
 *  - how much room for error: fewer spare flip flops per point of the goal, and a longer
 *    minimum flight time, which makes the player lead moving crabs further.
 * Every level keeps the crabs' lane below the shoreline of the background (see background.ts).
 */

const DEFAULT_SCORING: ScoringConfig = {
  comboStep: 3,
  maxMultiplier: 4,
  milestoneEvery: 100,
};

const LANE = { min: 150, max: 270 } as const;

/** Throw model shared by the early levels; later biomes override the flight limits. */
const THROW = { speedPxPerSec: 240, minFlightMs: 350, maxFlightMs: 800, arcHeightPx: 40 } as const;

function level(
  id: number,
  biome: Biome,
  rest: Omit<LevelConfig, 'id' | 'biome' | 'scoring' | 'throw'> &
    Partial<Pick<LevelConfig, 'scoring' | 'throw'>>,
): LevelConfig {
  return { id, biome, scoring: DEFAULT_SCORING, throw: THROW, ...rest };
}

export const LEVELS: readonly LevelConfig[] = [
  // ── Beach: common crabs, slow and forgiving. The first milestone is at 50 so the "score
  //    jingle" happens early, since a 100-point goal would clear the level right on it. ──
  level(1, 'beach', {
    ammo: 16,
    targetScore: 100,
    spawn: { intervalMs: { min: 900, max: 1600 }, maxOnScreen: 4, laneY: LANE },
    crabs: [{ type: 'common', weight: 1, speedPxPerSec: { min: 20, max: 40 } }],
    scoring: { ...DEFAULT_SCORING, milestoneEvery: 50 },
  }),
  level(2, 'beach', {
    ammo: 16,
    targetScore: 120,
    spawn: { intervalMs: { min: 800, max: 1400 }, maxOnScreen: 4, laneY: LANE },
    crabs: [{ type: 'common', weight: 1, speedPxPerSec: { min: 25, max: 50 } }],
    scoring: { ...DEFAULT_SCORING, milestoneEvery: 50 },
  }),
  level(3, 'beach', {
    ammo: 15,
    targetScore: 150,
    spawn: { intervalMs: { min: 800, max: 1300 }, maxOnScreen: 5, laneY: LANE },
    crabs: [
      { type: 'common', weight: 3, speedPxPerSec: { min: 30, max: 50 } },
      { type: 'swimmer', weight: 1, speedPxPerSec: { min: 45, max: 70 } },
    ],
    scoring: { ...DEFAULT_SCORING, milestoneEvery: 50 },
  }),

  // ── Rocks: swimmers join in, the first fiddler appears. ──
  level(4, 'rocks', {
    ammo: 15,
    targetScore: 170,
    spawn: { intervalMs: { min: 750, max: 1250 }, maxOnScreen: 5, laneY: LANE },
    crabs: [
      { type: 'common', weight: 2, speedPxPerSec: { min: 35, max: 55 } },
      { type: 'swimmer', weight: 2, speedPxPerSec: { min: 50, max: 75 } },
    ],
  }),
  level(5, 'rocks', {
    ammo: 14,
    targetScore: 200,
    spawn: { intervalMs: { min: 700, max: 1200 }, maxOnScreen: 5, laneY: LANE },
    crabs: [
      { type: 'common', weight: 2, speedPxPerSec: { min: 35, max: 60 } },
      { type: 'swimmer', weight: 2, speedPxPerSec: { min: 55, max: 80 } },
      { type: 'fiddler', weight: 1, speedPxPerSec: { min: 30, max: 50 } },
    ],
  }),
  level(6, 'rocks', {
    ammo: 14,
    targetScore: 230,
    spawn: { intervalMs: { min: 650, max: 1100 }, maxOnScreen: 6, laneY: LANE },
    crabs: [
      { type: 'common', weight: 2, speedPxPerSec: { min: 40, max: 65 } },
      { type: 'swimmer', weight: 2, speedPxPerSec: { min: 60, max: 85 } },
      { type: 'fiddler', weight: 2, speedPxPerSec: { min: 35, max: 55 } },
    ],
  }),

  // ── Mangrove: crowded, fiddlers are common. ──
  level(7, 'mangrove', {
    ammo: 14,
    targetScore: 260,
    spawn: { intervalMs: { min: 600, max: 1050 }, maxOnScreen: 6, laneY: LANE },
    crabs: [
      { type: 'common', weight: 2, speedPxPerSec: { min: 40, max: 65 } },
      { type: 'swimmer', weight: 2, speedPxPerSec: { min: 60, max: 90 } },
      { type: 'fiddler', weight: 2, speedPxPerSec: { min: 40, max: 60 } },
    ],
  }),
  level(8, 'mangrove', {
    ammo: 13,
    targetScore: 290,
    spawn: { intervalMs: { min: 550, max: 1000 }, maxOnScreen: 6, laneY: LANE },
    crabs: [
      { type: 'common', weight: 1, speedPxPerSec: { min: 45, max: 70 } },
      { type: 'swimmer', weight: 2, speedPxPerSec: { min: 65, max: 95 } },
      { type: 'fiddler', weight: 2, speedPxPerSec: { min: 45, max: 65 } },
    ],
  }),
  level(9, 'mangrove', {
    ammo: 13,
    targetScore: 320,
    spawn: { intervalMs: { min: 500, max: 950 }, maxOnScreen: 7, laneY: LANE },
    crabs: [
      { type: 'common', weight: 1, speedPxPerSec: { min: 45, max: 70 } },
      { type: 'swimmer', weight: 2, speedPxPerSec: { min: 70, max: 100 } },
      { type: 'fiddler', weight: 3, speedPxPerSec: { min: 50, max: 70 } },
    ],
  }),

  // ── Night: fast crabs, little room for error. ──
  level(10, 'night', {
    ammo: 13,
    targetScore: 350,
    spawn: { intervalMs: { min: 500, max: 900 }, maxOnScreen: 7, laneY: LANE },
    crabs: [
      { type: 'swimmer', weight: 3, speedPxPerSec: { min: 70, max: 105 } },
      { type: 'fiddler', weight: 3, speedPxPerSec: { min: 55, max: 75 } },
      { type: 'common', weight: 1, speedPxPerSec: { min: 50, max: 75 } },
    ],
  }),
  level(11, 'night', {
    ammo: 12,
    targetScore: 380,
    spawn: { intervalMs: { min: 450, max: 850 }, maxOnScreen: 7, laneY: LANE },
    crabs: [
      { type: 'swimmer', weight: 3, speedPxPerSec: { min: 75, max: 110 } },
      { type: 'fiddler', weight: 4, speedPxPerSec: { min: 60, max: 80 } },
      { type: 'common', weight: 1, speedPxPerSec: { min: 55, max: 80 } },
    ],
  }),
  level(12, 'night', {
    ammo: 12,
    targetScore: 440,
    spawn: { intervalMs: { min: 400, max: 800 }, maxOnScreen: 8, laneY: LANE },
    crabs: [
      { type: 'swimmer', weight: 3, speedPxPerSec: { min: 80, max: 115 } },
      { type: 'fiddler', weight: 4, speedPxPerSec: { min: 65, max: 85 } },
    ],
  }),
];
