import type { SlipperFlight, ThrowConfig } from '../entities/slipper';
import { clamp, distance, lerp, type Vec2 } from '../geometry';

export function flightDurationMs(origin: Vec2, target: Vec2, config: ThrowConfig): number {
  const rawMs = (distance(origin, target) / config.speedPxPerSec) * 1000;
  return clamp(rawMs, config.minFlightMs, config.maxFlightMs);
}

export function createFlight(
  id: number,
  origin: Vec2,
  target: Vec2,
  config: ThrowConfig,
): SlipperFlight {
  return {
    id,
    origin,
    target,
    durationMs: flightDurationMs(origin, target, config),
    elapsedMs: 0,
    arcHeightPx: config.arcHeightPx,
  };
}

export function advanceFlight(flight: SlipperFlight, dtMs: number): SlipperFlight {
  return { ...flight, elapsedMs: flight.elapsedMs + dtMs };
}

export function hasLanded(flight: SlipperFlight): boolean {
  return flight.elapsedMs >= flight.durationMs;
}

/** 0 at launch, 1 at landing. */
export function flightProgress(flight: SlipperFlight): number {
  if (flight.durationMs <= 0) return 1;
  return clamp(flight.elapsedMs / flight.durationMs, 0, 1);
}

/** Straight line origin → target plus a parabolic lift of `arcHeightPx` at mid-flight. */
export function slipperPosition(flight: SlipperFlight): Vec2 {
  const p = flightProgress(flight);
  if (p >= 1) return flight.target; // exact landing point, no float drift
  const lift = flight.arcHeightPx * 4 * p * (1 - p);
  return {
    x: lerp(flight.origin.x, flight.target.x, p),
    y: lerp(flight.origin.y, flight.target.y, p) - lift,
  };
}
