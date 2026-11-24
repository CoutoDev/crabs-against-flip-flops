import { CRAB_TYPE_IDS, type CrabType } from '../domain/entities/crab';
import type { DomainEvent } from '../domain/events';
import type { EventBus } from './event-bus';

/** What the round's events add up to, beyond what the round state already keeps. */
export interface RoundTallyStats {
  /** Flip flops that landed without hitting a crab. */
  readonly misses: number;
  /** The longest run of consecutive hits. */
  readonly bestCombo: number;
  readonly hitsByType: Readonly<Record<CrabType, number>>;
}

const emptyTally = (): RoundTallyStats => ({
  misses: 0,
  bestCombo: 0,
  hitsByType: Object.fromEntries(CRAB_TYPE_IDS.map((type) => [type, 0])) as Record<
    CrabType,
    number
  >,
});

/**
 * Listens to the bus and counts what the achievements need from a round (D36): the domain does
 * not know about achievements, it only publishes facts. Call `reset()` when a round begins, so a
 * round that was left halfway never leaks into the next one. The round-end listener of
 * `GameFlow` runs inside the same step as the last hit, so the numbers are complete by then.
 */
export class RoundTally {
  private current: RoundTallyStats = emptyTally();

  constructor(bus: EventBus<DomainEvent>) {
    bus.subscribe((event) => this.onEvent(event));
  }

  get stats(): RoundTallyStats {
    return this.current;
  }

  reset(): void {
    this.current = emptyTally();
  }

  private onEvent(event: DomainEvent): void {
    if (event.type === 'CrabHit') {
      this.current = {
        ...this.current,
        bestCombo: Math.max(this.current.bestCombo, event.combo),
        hitsByType: {
          ...this.current.hitsByType,
          [event.crabType]: this.current.hitsByType[event.crabType] + 1,
        },
      };
    } else if (event.type === 'SlipperMissed') {
      this.current = { ...this.current, misses: this.current.misses + 1 };
    }
  }
}
