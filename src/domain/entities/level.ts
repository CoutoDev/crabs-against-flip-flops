import type { CrabType } from './crab';
import type { ThrowConfig } from './slipper';

export type Biome = 'beach' | 'rocks' | 'mangrove' | 'night';

export interface Range {
  readonly min: number;
  readonly max: number;
}

export interface SpawnConfig {
  readonly intervalMs: Range;
  readonly maxOnScreen: number;
  /** Vertical band (field pixels) where crabs walk. */
  readonly laneY: Range;
}

export interface CrabSpawnEntry {
  readonly type: CrabType;
  readonly weight: number;
  readonly speedPxPerSec: Range;
}

export interface ScoringConfig {
  /** Consecutive hits needed to raise the multiplier by one step. */
  readonly comboStep: number;
  readonly maxMultiplier: number;
  /** A ScoreMilestone event fires every time the round score crosses a multiple of this. */
  readonly milestoneEvery: number;
}

export interface LevelConfig {
  readonly id: number;
  readonly biome: Biome;
  /** Flip flops available in the round. */
  readonly ammo: number;
  readonly targetScore: number;
  readonly spawn: SpawnConfig;
  readonly crabs: readonly CrabSpawnEntry[];
  readonly throw: ThrowConfig;
  readonly scoring: ScoringConfig;
}
