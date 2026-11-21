import { describe, expect, it } from 'vitest';
import { STEP_MS, THROW_ORIGIN } from '../constants';
import type { SlipperFlight } from '../entities/slipper';
import type { DomainEvent } from '../events';
import type { Vec2 } from '../geometry';
import { makeCrab, makeLevel, must, ofType, TEST_CRAB_SPECS } from '../test-support';
import { createFlight } from './trajectory';
import { createRound, step, throwSlipper, type RoundConfig, type RoundState } from './round';

const configOf = (level = makeLevel()): RoundConfig => ({ level, crabSpecs: TEST_CRAB_SPECS });

/** A round where nothing spawns on its own, so tests control every crab. */
const quietRound = (level = makeLevel()): RoundState => ({
  ...createRound(configOf(level), 1),
  spawnCooldownMs: 1_000_000,
});

/** A flip flop that lands on the next 5 ms step. */
const landingNext = (id: number, target: Vec2): SlipperFlight => ({
  id,
  origin: THROW_ORIGIN,
  target,
  durationMs: 100,
  elapsedMs: 95,
  arcHeightPx: 0,
});

describe('createRound', () => {
  it('starts a fresh round from the level config', () => {
    const state = createRound(configOf(), 42);
    expect(state).toMatchObject({
      status: 'playing',
      ammo: 10,
      score: 0,
      combo: 0,
      throws: 0,
      hits: 0,
      timeMs: 0,
    });
    expect(state.crabs).toEqual([]);
    expect(state.flights).toEqual([]);
    expect(state.spawnCooldownMs).toBeGreaterThanOrEqual(500);
    expect(state.spawnCooldownMs).toBeLessThanOrEqual(1000);
  });

  it('refuses an invalid level', () => {
    expect(() => createRound(configOf(makeLevel({ ammo: 0 })), 1)).toThrow(/ammo/);
  });
});

describe('throwSlipper', () => {
  it('spends one flip flop and puts it in the air', () => {
    const { state, events } = throwSlipper(quietRound(), { x: 100, y: 100 });
    const flight = must(state.flights[0]);
    expect(state.ammo).toBe(9);
    expect(state.throws).toBe(1);
    expect(flight).toMatchObject({
      origin: THROW_ORIGIN,
      target: { x: 100, y: 100 },
      elapsedMs: 0,
    });
    expect(events).toEqual([
      {
        type: 'SlipperThrown',
        flightId: flight.id,
        target: { x: 100, y: 100 },
        durationMs: flight.durationMs,
      },
    ]);
  });

  it('clamps the target to the field', () => {
    const { state } = throwSlipper(quietRound(), { x: -50, y: 999 });
    expect(must(state.flights[0]).target).toEqual({ x: 0, y: 180 });
  });

  it('rejects non-finite targets as a programming error', () => {
    expect(() => throwSlipper(quietRound(), { x: Number.NaN, y: 0 })).toThrow(RangeError);
  });

  it('rejects the throw when out of ammo, leaving the state untouched', () => {
    const empty = { ...quietRound(), ammo: 0 };
    const { state, events } = throwSlipper(empty, { x: 100, y: 100 });
    expect(state).toBe(empty);
    expect(events).toEqual([{ type: 'ThrowRejected', reason: 'no_ammo' }]);
  });

  it('rejects the throw once the round is over', () => {
    const over = { ...quietRound(), status: 'won' as const };
    const { events } = throwSlipper(over, { x: 100, y: 100 });
    expect(events).toEqual([{ type: 'ThrowRejected', reason: 'round_over' }]);
  });
});

describe('step: flight and landing', () => {
  it('only resolves a flip flop on the step where it lands', () => {
    const thrown = throwSlipper(quietRound(), { x: 100, y: 100 }).state;
    const duration = must(thrown.flights[0]).durationMs;
    const first = step(thrown, duration / 2);
    expect(first.state.flights).toHaveLength(1);
    expect(first.events).toEqual([]);
    const second = step(first.state, duration / 2);
    expect(second.state.flights).toHaveLength(0);
    expect(ofType(second.events, 'SlipperMissed')).toHaveLength(1);
  });

  it('refuses invalid time steps', () => {
    expect(() => step(quietRound(), -1)).toThrow(RangeError);
    expect(() => step(quietRound(), Number.NaN)).toThrow(RangeError);
  });

  it('does not mutate the previous state', () => {
    const state = {
      ...quietRound(),
      crabs: [makeCrab({ speedPxPerSec: 50 })],
      flights: [createFlight(9, THROW_ORIGIN, { x: 50, y: 50 }, makeLevel().throw)],
    };
    const snapshot = structuredClone(state);
    step(state, STEP_MS);
    expect(state).toEqual(snapshot);
  });
});

describe('step: hits, misses and combo', () => {
  it('scores a hit and removes the crab', () => {
    const state = {
      ...quietRound(),
      crabs: [makeCrab({ id: 50, x: 100, y: 100 })],
      flights: [landingNext(51, { x: 104, y: 100 })],
    };
    const { state: next, events } = step(state, 5);
    expect(must(ofType(events, 'CrabHit')[0])).toMatchObject({
      crabId: 50,
      crabType: 'common',
      basePoints: 10,
      multiplier: 1,
      points: 10,
      combo: 1,
      score: 10,
    });
    expect(next).toMatchObject({ score: 10, combo: 1, hits: 1 });
    expect(next.crabs).toHaveLength(0);
    expect(next.flights).toHaveLength(0);
  });

  it('a miss resets the combo and leaves the crab alone', () => {
    const state = {
      ...quietRound(),
      combo: 2,
      crabs: [makeCrab({ x: 100, y: 100 })],
      flights: [landingNext(51, { x: 200, y: 100 })],
    };
    const { state: next, events } = step(state, 5);
    expect(must(ofType(events, 'SlipperMissed')[0])).toMatchObject({
      flightId: 51,
      position: { x: 200, y: 100 },
      lostCombo: 2,
    });
    expect(next).toMatchObject({ score: 0, combo: 0 });
    expect(next.crabs).toHaveLength(1);
  });

  it('raises the multiplier on consecutive hits', () => {
    let state = quietRound(makeLevel({ ammo: 20, targetScore: 600 }));
    const multipliers: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      state = {
        ...state,
        crabs: [makeCrab({ id: 200 + i })],
        flights: [landingNext(300 + i, { x: 100, y: 100 })],
      };
      const result = step(state, 5);
      state = result.state;
      multipliers.push(must(ofType(result.events, 'CrabHit')[0]).multiplier);
    }
    expect(multipliers).toEqual([1, 1, 1, 2]);
    expect(state.score).toBe(10 + 10 + 10 + 20);
  });

  it('emits one milestone event per multiple crossed, after the hit', () => {
    const level = makeLevel({
      ammo: 20,
      targetScore: 600,
      scoring: { comboStep: 3, maxMultiplier: 4, milestoneEvery: 5 },
    });
    const state = {
      ...quietRound(level),
      combo: 3, // the next hit is the 4th in a row: x2 → 20 points
      crabs: [makeCrab()],
      flights: [landingNext(51, { x: 100, y: 100 })],
    };
    const { events } = step(state, 5);
    expect(events.map((e: DomainEvent) => e.type)).toEqual([
      'CrabHit',
      'ScoreMilestone',
      'ScoreMilestone',
      'ScoreMilestone',
      'ScoreMilestone',
    ]);
    expect(ofType(events, 'ScoreMilestone').map((e) => e.milestone)).toEqual([5, 10, 15, 20]);
  });
});

describe('step: crabs', () => {
  it('removes crabs that walked off the field', () => {
    const state = {
      ...quietRound(),
      crabs: [makeCrab({ x: 330, direction: 1, speedPxPerSec: 600 })],
    };
    expect(step(state, 20).state.crabs).toHaveLength(0);
  });

  it('spawns crabs over time inside the lane and never above the on-screen cap', () => {
    let state = createRound(configOf(), 7);
    let maxSeen = 0;
    for (let i = 0; i < 20 * 60; i += 1) {
      state = step(state, STEP_MS).state;
      maxSeen = Math.max(maxSeen, state.crabs.length);
      for (const crab of state.crabs) {
        expect(crab.y).toBeGreaterThanOrEqual(80);
        expect(crab.y).toBeLessThanOrEqual(140);
      }
    }
    expect(state.status).toBe('playing');
    expect(maxSeen).toBe(3);
  });
});

describe('step: end of round', () => {
  it('wins as soon as the target score is reached', () => {
    const state = {
      ...quietRound(makeLevel({ targetScore: 10 })),
      crabs: [makeCrab()],
      flights: [landingNext(51, { x: 100, y: 100 })],
    };
    const { state: next, events } = step(state, 5);
    expect(next.status).toBe('won');
    expect(events.map((e) => e.type)).toEqual(['CrabHit', 'LevelCleared']);
    expect(must(ofType(events, 'LevelCleared')[0])).toEqual({
      type: 'LevelCleared',
      score: 10,
      ammoLeft: 10,
    });
  });

  it('freezes once the round is over', () => {
    const won = { ...quietRound(), status: 'won' as const };
    const result = step(won, STEP_MS);
    expect(result.state).toBe(won);
    expect(result.events).toEqual([]);
  });

  it('loses when out of ammo with nothing left in the air and the target not reached', () => {
    let state = throwSlipper(quietRound(makeLevel({ ammo: 1, targetScore: 10 })), {
      x: 10,
      y: 10,
    }).state;
    expect(state.ammo).toBe(0);

    const events: DomainEvent[] = [];
    for (let i = 0; i < 200 && state.status === 'playing'; i += 1) {
      const result = step(state, STEP_MS);
      state = result.state;
      events.push(...result.events);
    }
    expect(state.status).toBe('lost');
    expect(events.map((e) => e.type)).toEqual(['SlipperMissed', 'RoundLost']);
  });

  it('is not lost while the last flip flop is still in the air', () => {
    const state = throwSlipper(quietRound(makeLevel({ ammo: 1, targetScore: 10 })), {
      x: 10,
      y: 10,
    }).state;
    const { state: next } = step(state, STEP_MS);
    expect(next.ammo).toBe(0);
    expect(next.flights).toHaveLength(1);
    expect(next.status).toBe('playing');
  });
});

describe('determinism', () => {
  const simulate = (seed: number): RoundState => {
    let state = createRound(configOf(makeLevel({ ammo: 20, targetScore: 600 })), seed);
    for (let i = 0; i < 600; i += 1) {
      if (i % 45 === 0) state = throwSlipper(state, { x: (i * 7) % 320, y: 100 }).state;
      state = step(state, STEP_MS).state;
    }
    return state;
  };

  it('replays identically for the same seed and inputs', () => {
    expect(simulate(1234)).toEqual(simulate(1234));
  });

  it('diverges for a different seed', () => {
    expect(simulate(1)).not.toEqual(simulate(2));
  });
});
