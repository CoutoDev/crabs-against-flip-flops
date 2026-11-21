import { describe, expect, it } from 'vitest';
import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX, STEP_MS, THROW_ORIGIN } from '../domain/constants';
import type { Crab } from '../domain/entities/crab';
import type { LevelConfig } from '../domain/entities/level';
import type { Vec2 } from '../domain/geometry';
import { between, createRng, type Rng } from '../domain/rng';
import { createRound, step, throwSlipper, type RoundState } from '../domain/rules/round';
import { flightDurationMs } from '../domain/rules/trajectory';
import { CRAB_TYPES } from './crab-types';
import { LEVELS } from './levels';

/**
 * Balance guard: simulated players of different skill play each level on many seeds.
 * These are not unit tests of one rule; they catch a retune that makes a level impossible
 * (or trivial). Thresholds are deliberately loose: tune the data, not the thresholds.
 */

/** Where a crab will be when a flip flop thrown now lands (fixed point on the flight time). */
function leadTarget(level: LevelConfig, crab: Crab): Vec2 {
  let target: Vec2 = { x: crab.x, y: crab.y };
  for (let i = 0; i < 5; i += 1) {
    const flightMs = flightDurationMs(THROW_ORIGIN, target, level.throw);
    target = { x: crab.x + (crab.direction * crab.speedPxPerSec * flightMs) / 1000, y: crab.y };
  }
  return target;
}

type Aim = (state: RoundState, rng: Rng) => Vec2 | undefined;

const onField = (p: Vec2) => p.x >= 0 && p.x <= FIELD_WIDTH_PX;

const perfectAim =
  (errorPx: number): Aim =>
  (state, rng) => {
    const { level } = state.config;
    for (const crab of state.crabs) {
      const target = leadTarget(level, crab);
      if (!onField(target)) continue;
      return {
        x: target.x + between(rng, -errorPx, errorPx),
        y: target.y + between(rng, -errorPx, errorPx),
      };
    }
    return undefined;
  };

const randomAim: Aim = (_state, rng) => ({
  x: between(rng, 0, FIELD_WIDTH_PX),
  y: between(rng, 0, FIELD_HEIGHT_PX),
});

/** One flip flop in the air at a time. Returns the final state. */
function play(level: LevelConfig, seed: number, aim: Aim): RoundState {
  const botRng = createRng(seed * 7919);
  let state = createRound({ level, crabSpecs: CRAB_TYPES }, seed);
  for (let i = 0; i < 60 * 600 && state.status === 'playing'; i += 1) {
    if (state.flights.length === 0 && state.ammo > 0) {
      const target = aim(state, botRng);
      if (target !== undefined) state = throwSlipper(state, target).state;
    }
    state = step(state, STEP_MS).state;
  }
  return state;
}

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const winRate = (level: LevelConfig, aim: Aim): number =>
  SEEDS.filter((seed) => play(level, seed, aim).status === 'won').length / SEEDS.length;

describe.each(LEVELS.map((level) => [level.id, level] as const))(
  'balance: level %i',
  (_id, level) => {
    it('is always won by a perfect player', () => {
      expect(winRate(level, perfectAim(0))).toBe(1);
    });

    it('is usually won by a decent player (aim off by up to 8px)', () => {
      expect(winRate(level, perfectAim(8))).toBeGreaterThanOrEqual(0.7);
    });

    it('is practically never won by throwing at random', () => {
      expect(winRate(level, randomAim)).toBeLessThanOrEqual(0.1);
    });

    it('does not end by itself while the player never throws (no timer, by design: D8)', () => {
      let state = createRound({ level, crabSpecs: CRAB_TYPES }, 1);
      for (let i = 0; i < 60 * 30; i += 1) state = step(state, STEP_MS).state;
      expect(state.status).toBe('playing');
    });
  },
);
