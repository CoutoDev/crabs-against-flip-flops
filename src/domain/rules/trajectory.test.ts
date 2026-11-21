import { describe, expect, it } from 'vitest';
import type { ThrowConfig } from '../entities/slipper';
import {
  advanceFlight,
  createFlight,
  flightDurationMs,
  flightProgress,
  hasLanded,
  slipperPosition,
} from './trajectory';

const config: ThrowConfig = {
  speedPxPerSec: 200,
  minFlightMs: 300,
  maxFlightMs: 800,
  arcHeightPx: 30,
};
const origin = { x: 0, y: 100 };
const target = { x: 100, y: 100 };

describe('flightDurationMs', () => {
  it('is proportional to the distance inside the allowed range', () => {
    expect(flightDurationMs(origin, target, config)).toBe(500);
  });

  it('never goes below the minimum flight time', () => {
    expect(flightDurationMs(origin, { x: 10, y: 100 }, config)).toBe(300);
  });

  it('never exceeds the maximum flight time', () => {
    expect(flightDurationMs(origin, { x: 400, y: 100 }, config)).toBe(800);
  });
});

describe('slipperPosition', () => {
  const flight = createFlight(1, origin, target, config);
  const at = (elapsedMs: number) => slipperPosition({ ...flight, elapsedMs });

  it('starts at the origin', () => {
    expect(at(0)).toEqual(origin);
  });

  it('lands exactly on the target', () => {
    expect(at(flight.durationMs)).toEqual(target);
    expect(at(flight.durationMs + 1000)).toEqual(target);
  });

  it('reaches the arc apex at mid-flight', () => {
    expect(at(flight.durationMs / 2)).toEqual({ x: 50, y: 70 });
  });

  it('draws a symmetric arc between endpoints at the same height', () => {
    const early = at(flight.durationMs * 0.25);
    const late = at(flight.durationMs * 0.75);
    expect(early.y).toBe(late.y);
    expect(early.x).toBe(25);
    expect(late.x).toBe(75);
  });

  it('lands exactly on the target even when interpolation would drift (160 → 10.7)', () => {
    const awkward = createFlight(2, { x: 160, y: 172 }, { x: 10.7, y: 100 }, config);
    // lerp(160, 10.7, 1) is 10.699999999999989 in floating point: the guard must prevent that.
    expect(slipperPosition({ ...awkward, elapsedMs: awkward.durationMs })).toEqual({
      x: 10.7,
      y: 100,
    });
  });

  it('is a flat line when the arc height is zero', () => {
    const flat = createFlight(1, origin, target, { ...config, arcHeightPx: 0 });
    expect(slipperPosition({ ...flat, elapsedMs: flat.durationMs / 2 }).y).toBe(100);
  });
});

describe('flight lifecycle', () => {
  it('advances without mutating the previous state', () => {
    const flight = createFlight(1, origin, target, config);
    const next = advanceFlight(flight, 100);
    expect(next.elapsedMs).toBe(100);
    expect(flight.elapsedMs).toBe(0);
  });

  it('lands exactly when elapsed time reaches the duration', () => {
    const flight = createFlight(1, origin, target, config);
    expect(hasLanded({ ...flight, elapsedMs: flight.durationMs - 1 })).toBe(false);
    expect(hasLanded({ ...flight, elapsedMs: flight.durationMs })).toBe(true);
  });

  it('reports progress between 0 and 1', () => {
    const flight = createFlight(1, origin, target, config);
    expect(flightProgress(flight)).toBe(0);
    expect(flightProgress({ ...flight, elapsedMs: flight.durationMs / 2 })).toBe(0.5);
    expect(flightProgress({ ...flight, elapsedMs: flight.durationMs * 3 })).toBe(1);
  });
});
