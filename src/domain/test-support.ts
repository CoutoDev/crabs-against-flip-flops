/** Fixtures shared by domain tests. Not imported by production code. */
import type { Crab, CrabSpecs } from './entities/crab';
import type { LevelConfig } from './entities/level';
import type { DomainEvent } from './events';
import type { Rng } from './rng';

export const TEST_CRAB_SPECS: CrabSpecs = {
  common: { points: 10, hitRadiusPx: 10 },
  swimmer: { points: 20, hitRadiusPx: 8 },
  fiddler: { points: 30, hitRadiusPx: 6 },
};

export function makeLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: 1,
    biome: 'beach',
    ammo: 10,
    targetScore: 100,
    spawn: {
      intervalMs: { min: 500, max: 1000 },
      maxOnScreen: 3,
      laneY: { min: 80, max: 140 },
    },
    crabs: [{ type: 'common', weight: 1, speedPxPerSec: { min: 20, max: 40 } }],
    throw: { speedPxPerSec: 200, minFlightMs: 300, maxFlightMs: 800, arcHeightPx: 30 },
    scoring: { comboStep: 3, maxMultiplier: 4, milestoneEvery: 50 },
    ...overrides,
  };
}

/** A motionless crab by default, so tests control exactly where it is. */
export function makeCrab(overrides: Partial<Crab> = {}): Crab {
  return { id: 100, type: 'common', x: 100, y: 100, direction: 1, speedPxPerSec: 0, ...overrides };
}

/** Rng that replays `values` in order and then repeats the last one. */
export function sequenceRng(values: readonly number[]): Rng {
  let index = 0;
  return {
    next() {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      if (value === undefined) throw new Error('sequenceRng needs at least one value');
      return value;
    },
    get state() {
      return index;
    },
  };
}

export function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value, got undefined');
  return value;
}

export function ofType<T extends DomainEvent['type']>(
  events: readonly DomainEvent[],
  type: T,
): Extract<DomainEvent, { type: T }>[] {
  return events.filter((event): event is Extract<DomainEvent, { type: T }> => event.type === type);
}
