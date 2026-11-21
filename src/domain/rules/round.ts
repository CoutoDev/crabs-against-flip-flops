import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX, SLIPPER_RADIUS_PX, THROW_ORIGIN } from '../constants';
import type { Crab, CrabSpecs } from '../entities/crab';
import type { LevelConfig } from '../entities/level';
import type { SlipperFlight } from '../entities/slipper';
import type { DomainEvent, ThrowRejectionReason } from '../events';
import { clamp, type Vec2 } from '../geometry';
import { between, createRng } from '../rng';
import { findHitCrab } from './collision';
import { isCrabGone, moveCrab, spawnCrab } from './crabs';
import { assertValidLevel } from './level-validation';
import { comboMultiplier, milestonesCrossed } from './scoring';
import { advanceFlight, createFlight, hasLanded } from './trajectory';

export type RoundStatus = 'playing' | 'won' | 'lost';

export interface RoundConfig {
  readonly level: LevelConfig;
  readonly crabSpecs: CrabSpecs;
}

/** Complete, immutable snapshot of a round. Everything the simulation needs lives here. */
export interface RoundState {
  readonly config: RoundConfig;
  readonly status: RoundStatus;
  readonly timeMs: number;
  readonly ammo: number;
  readonly score: number;
  /** Consecutive hits since the last miss. */
  readonly combo: number;
  readonly throws: number;
  readonly hits: number;
  readonly crabs: readonly Crab[];
  readonly flights: readonly SlipperFlight[];
  readonly nextEntityId: number;
  readonly spawnCooldownMs: number;
  /** Rng state, so `step` stays a pure function of the previous state. */
  readonly rngState: number;
}

export interface Transition {
  readonly state: RoundState;
  readonly events: readonly DomainEvent[];
}

export function createRound(config: RoundConfig, seed: number): RoundState {
  assertValidLevel(config.level, config.crabSpecs);
  const { level } = config;
  const rng = createRng(seed);
  const spawnCooldownMs = between(rng, level.spawn.intervalMs.min, level.spawn.intervalMs.max);
  return {
    config,
    status: 'playing',
    timeMs: 0,
    ammo: level.ammo,
    score: 0,
    combo: 0,
    throws: 0,
    hits: 0,
    crabs: [],
    flights: [],
    nextEntityId: 1,
    spawnCooldownMs,
    rngState: rng.state,
  };
}

const rejected = (state: RoundState, reason: ThrowRejectionReason): Transition => ({
  state,
  events: [{ type: 'ThrowRejected', reason }],
});

/** The player throws a flip flop at `target` (clamped to the field). */
export function throwSlipper(state: RoundState, target: Vec2): Transition {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    throw new RangeError('throwSlipper: target must be finite');
  }
  if (state.status !== 'playing') return rejected(state, 'round_over');
  if (state.ammo <= 0) return rejected(state, 'no_ammo');

  const landing = {
    x: clamp(target.x, 0, FIELD_WIDTH_PX),
    y: clamp(target.y, 0, FIELD_HEIGHT_PX),
  };
  const flight = createFlight(state.nextEntityId, THROW_ORIGIN, landing, state.config.level.throw);
  return {
    state: {
      ...state,
      ammo: state.ammo - 1,
      throws: state.throws + 1,
      flights: [...state.flights, flight],
      nextEntityId: state.nextEntityId + 1,
    },
    events: [
      {
        type: 'SlipperThrown',
        flightId: flight.id,
        target: landing,
        durationMs: flight.durationMs,
      },
    ],
  };
}

/**
 * Advances the round by `dtMs` (the game loop passes STEP_MS). Order inside one step:
 * crabs walk → flip flops fly → landings resolve → crabs spawn → win/lose check.
 * Pure: same state + same dt always yields the same result.
 */
export function step(state: RoundState, dtMs: number): Transition {
  if (!Number.isFinite(dtMs) || dtMs < 0) {
    throw new RangeError(`step: dtMs must be a finite number >= 0, got ${dtMs}`);
  }
  if (state.status !== 'playing') return { state, events: [] };

  const { level, crabSpecs } = state.config;
  const events: DomainEvent[] = [];

  let crabs = state.crabs.map((crab) => moveCrab(crab, dtMs)).filter((crab) => !isCrabGone(crab));
  const advanced = state.flights.map((flight) => advanceFlight(flight, dtMs));
  const landed = advanced.filter(hasLanded);
  const flying = advanced.filter((flight) => !hasLanded(flight));

  let { score, combo, hits } = state;
  for (const flight of landed) {
    const hit = findHitCrab(flight.target, crabs, crabSpecs, SLIPPER_RADIUS_PX);
    if (hit === undefined) {
      events.push({
        type: 'SlipperMissed',
        flightId: flight.id,
        position: flight.target,
        lostCombo: combo,
      });
      combo = 0;
      continue;
    }

    combo += 1;
    hits += 1;
    const basePoints = crabSpecs[hit.type].points;
    const multiplier = comboMultiplier(combo, level.scoring);
    const points = basePoints * multiplier;
    const previousScore = score;
    score += points;
    crabs = crabs.filter((crab) => crab.id !== hit.id);
    events.push({
      type: 'CrabHit',
      crabId: hit.id,
      crabType: hit.type,
      position: { x: hit.x, y: hit.y },
      basePoints,
      multiplier,
      points,
      combo,
      score,
    });
    for (const milestone of milestonesCrossed(previousScore, score, level.scoring.milestoneEvery)) {
      events.push({ type: 'ScoreMilestone', milestone, score });
    }
  }

  const won = score >= level.targetScore;

  const rng = createRng(state.rngState);
  let spawnCooldownMs = state.spawnCooldownMs - dtMs;
  let nextEntityId = state.nextEntityId;
  if (!won && spawnCooldownMs <= 0) {
    if (crabs.length < level.spawn.maxOnScreen) {
      crabs = [...crabs, spawnCrab(nextEntityId, level, rng)];
      nextEntityId += 1;
    }
    // A blocked spawn (screen full) is skipped, not queued: the next attempt waits a fresh interval.
    spawnCooldownMs = between(rng, level.spawn.intervalMs.min, level.spawn.intervalMs.max);
  }

  let status: RoundStatus = 'playing';
  if (won) {
    status = 'won';
    events.push({ type: 'LevelCleared', score, ammoLeft: state.ammo });
  } else if (state.ammo === 0 && flying.length === 0) {
    status = 'lost';
    events.push({ type: 'RoundLost', score });
  }

  return {
    state: {
      ...state,
      status,
      timeMs: state.timeMs + dtMs,
      score,
      combo,
      hits,
      crabs,
      flights: flying,
      nextEntityId,
      spawnCooldownMs,
      rngState: rng.state,
    },
    events,
  };
}
