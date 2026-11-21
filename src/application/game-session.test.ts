import { describe, expect, it } from 'vitest';
import { STEP_MS } from '../domain/constants';
import type { DomainEvent } from '../domain/events';
import { makeLevel, ofType, TEST_CRAB_SPECS } from '../domain/test-support';
import { EventBus } from './event-bus';
import { GameSession, MAX_FRAME_MS } from './game-session';

function setup(levelOverrides = {}) {
  const bus = new EventBus<DomainEvent>();
  const events: DomainEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const session = new GameSession(
    { level: makeLevel(levelOverrides), crabSpecs: TEST_CRAB_SPECS },
    1,
    bus,
  );
  return { session, events };
}

describe('GameSession.advance', () => {
  it('runs one fixed step per STEP_MS of real time, carrying the remainder', () => {
    const { session } = setup();
    expect(session.advance(STEP_MS * 0.4)).toBe(0);
    expect(session.advance(STEP_MS * 0.4)).toBe(0);
    expect(session.advance(STEP_MS * 0.4)).toBe(1); // 1.2 steps accumulated
    expect(session.state.timeMs).toBeCloseTo(STEP_MS, 6);
  });

  it('is independent of the frame rate: same real time, same simulated time', () => {
    const slow = setup().session; // 30 fps
    const fast = setup().session; // 144 fps
    for (let i = 0; i < 30; i += 1) slow.advance(1000 / 30);
    for (let i = 0; i < 144; i += 1) fast.advance(1000 / 144);
    // Only the leftover in the accumulator (less than one step) may differ.
    const difference = Math.abs(slow.state.timeMs - fast.state.timeMs);
    expect(difference).toBeLessThanOrEqual(STEP_MS + 1e-6);
    expect(slow.state.timeMs).toBeGreaterThan(900);
    expect(fast.state.timeMs).toBeGreaterThan(900);
  });

  it('caps a huge frame so it cannot trigger a burst of simulation', () => {
    const { session } = setup();
    const steps = session.advance(60_000);
    expect(steps).toBeLessThanOrEqual(Math.ceil(MAX_FRAME_MS / STEP_MS));
  });

  it('ignores negative deltas', () => {
    const { session } = setup();
    expect(session.advance(-100)).toBe(0);
  });
});

describe('GameSession pause', () => {
  it('does not simulate while paused and does not burst after resuming', () => {
    const { session } = setup();
    session.pause();
    expect(session.advance(1000)).toBe(0);
    expect(session.state.timeMs).toBe(0);
    session.resume();
    expect(session.advance(STEP_MS * 0.5)).toBe(0);
  });

  it('ignores throws while paused', () => {
    const { session, events } = setup();
    session.pause();
    session.throwAt({ x: 100, y: 100 });
    expect(events).toEqual([]);
    expect(session.state.ammo).toBe(10);
  });
});

describe('GameSession events', () => {
  it('publishes the domain events produced by a throw', () => {
    const { session, events } = setup();
    session.throwAt({ x: 100, y: 100 });
    expect(ofType(events, 'SlipperThrown')).toHaveLength(1);
    expect(session.state.ammo).toBe(9);
  });

  it('publishes a rejection when there is no ammo', () => {
    const { session, events } = setup({ ammo: 1, targetScore: 10 });
    session.throwAt({ x: 100, y: 100 });
    session.throwAt({ x: 100, y: 100 });
    expect(ofType(events, 'ThrowRejected')).toEqual([{ type: 'ThrowRejected', reason: 'no_ammo' }]);
  });

  it('plays a lost round to the end and then stops advancing', () => {
    const { session, events } = setup({ ammo: 1, targetScore: 10 });
    session.throwAt({ x: 5, y: 5 });
    for (let i = 0; i < 200; i += 1) session.advance(STEP_MS);
    expect(session.state.status).toBe('lost');
    expect(ofType(events, 'RoundLost')).toHaveLength(1);
    expect(session.advance(1000)).toBe(0);
  });
});
