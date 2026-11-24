import { describe, expect, it } from 'vitest';
import type { CrabType } from '../domain/entities/crab';
import type { DomainEvent } from '../domain/events';
import { EventBus } from './event-bus';
import { RoundTally } from './round-stats';

const hit = (crabType: CrabType, combo: number): DomainEvent => ({
  type: 'CrabHit',
  crabId: 1,
  crabType,
  position: { x: 0, y: 0 },
  basePoints: 10,
  multiplier: 1,
  points: 10,
  combo,
  score: 10,
});
const miss: DomainEvent = {
  type: 'SlipperMissed',
  flightId: 1,
  position: { x: 0, y: 0 },
  lostCombo: 0,
};

function make() {
  const bus = new EventBus<DomainEvent>();
  return { bus, tally: new RoundTally(bus) };
}

describe('RoundTally', () => {
  it('starts empty', () => {
    expect(make().tally.stats).toEqual({
      misses: 0,
      bestCombo: 0,
      hitsByType: { common: 0, swimmer: 0, fiddler: 0 },
    });
  });

  it('counts hits by crab type and keeps the longest combo', () => {
    const { bus, tally } = make();
    for (const event of [
      hit('common', 1),
      hit('fiddler', 2),
      hit('fiddler', 3),
      miss,
      hit('common', 1),
    ]) {
      bus.publish(event);
    }
    expect(tally.stats.hitsByType).toEqual({ common: 2, swimmer: 0, fiddler: 2 });
    expect(tally.stats.bestCombo).toBe(3);
    expect(tally.stats.misses).toBe(1);
  });

  it('ignores events that are not hits or misses', () => {
    const { bus, tally } = make();
    bus.publish({ type: 'ThrowRejected', reason: 'no_ammo' });
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(tally.stats.misses).toBe(0);
  });

  it('starts from zero after reset, so a round left halfway does not leak into the next', () => {
    const { bus, tally } = make();
    bus.publish(hit('swimmer', 5));
    bus.publish(miss);
    tally.reset();
    expect(tally.stats).toEqual({
      misses: 0,
      bestCombo: 0,
      hitsByType: { common: 0, swimmer: 0, fiddler: 0 },
    });
    bus.publish(hit('common', 1));
    expect(tally.stats.bestCombo).toBe(1);
  });

  it('never changes a snapshot it already gave out', () => {
    const { bus, tally } = make();
    const before = tally.stats;
    bus.publish(hit('common', 1));
    expect(before.hitsByType.common).toBe(0);
  });
});
