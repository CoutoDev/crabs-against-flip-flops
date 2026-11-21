import type { Vec2 } from '../geometry';

export interface ThrowConfig {
  /** Horizontal-ish travel speed; flight time = distance / speed, clamped to [min, max]. */
  readonly speedPxPerSec: number;
  readonly minFlightMs: number;
  readonly maxFlightMs: number;
  /** Visual apex of the arc. Does not affect hits: only the landing point counts. */
  readonly arcHeightPx: number;
}

/** A flip flop in the air. Its state is a pure function of `elapsedMs`. */
export interface SlipperFlight {
  readonly id: number;
  readonly origin: Vec2;
  readonly target: Vec2;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly arcHeightPx: number;
}
