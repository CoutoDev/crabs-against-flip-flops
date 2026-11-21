import { STEP_MS } from '../domain/constants';
import type { DomainEvent } from '../domain/events';
import { clamp, type Vec2 } from '../domain/geometry';
import {
  createRound,
  step,
  throwSlipper,
  type RoundConfig,
  type RoundState,
  type Transition,
} from '../domain/rules/round';
import type { EventBus } from './event-bus';

/** A long frame (tab in background, debugger) is cut to this, so we never simulate a huge burst. */
export const MAX_FRAME_MS = 250;

/**
 * Drives one round: owns the RoundState, converts real frame times into fixed 60 Hz simulation
 * steps (accumulator) and publishes every domain event on the bus.
 * Renderers read `state`; sound, effects and HUD subscribe to the bus.
 */
export class GameSession {
  private current: RoundState;
  private accumulatorMs = 0;
  private isPaused = false;
  private readonly bus: EventBus<DomainEvent>;

  constructor(config: RoundConfig, seed: number, bus: EventBus<DomainEvent>) {
    this.current = createRound(config, seed);
    this.bus = bus;
  }

  get state(): RoundState {
    return this.current;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.accumulatorMs = 0; // no catch-up burst for the time spent paused
  }

  /** Player input. Ignored while paused. */
  throwAt(target: Vec2): void {
    if (this.isPaused) return;
    this.apply(throwSlipper(this.current, target));
  }

  /** Feeds real elapsed time; returns how many simulation steps ran. */
  advance(frameDeltaMs: number): number {
    if (this.isPaused || this.current.status !== 'playing') return 0;
    this.accumulatorMs += clamp(frameDeltaMs, 0, MAX_FRAME_MS);
    let steps = 0;
    while (this.accumulatorMs >= STEP_MS && this.current.status === 'playing') {
      this.apply(step(this.current, STEP_MS));
      this.accumulatorMs -= STEP_MS;
      steps += 1;
    }
    return steps;
  }

  private apply(transition: Transition): void {
    this.current = transition.state;
    for (const event of transition.events) this.bus.publish(event);
  }
}
