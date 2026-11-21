import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './event-bus';

describe('EventBus', () => {
  it('delivers events to every subscriber in subscription order', () => {
    const bus = new EventBus<number>();
    const seen: string[] = [];
    bus.subscribe((n) => seen.push(`a${n}`));
    bus.subscribe((n) => seen.push(`b${n}`));
    bus.publish(1);
    bus.publish(2);
    expect(seen).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus<number>();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(handler);
    bus.publish(1);
    unsubscribe();
    bus.publish(2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('tolerates unsubscribing during a publish', () => {
    const bus = new EventBus<number>();
    const second = vi.fn();
    const unsubscribeFirst = bus.subscribe(() => unsubscribeFirst());
    bus.subscribe(second);
    bus.publish(1);
    bus.publish(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('isolates a failing subscriber from the others', () => {
    const onError = vi.fn();
    const bus = new EventBus<number>(onError);
    const survivor = vi.fn();
    const boom = new Error('boom');
    bus.subscribe(() => {
      throw boom;
    });
    bus.subscribe(survivor);
    bus.publish(1);
    expect(survivor).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalledWith(boom);
  });
});
