import { describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '../domain/events';
import { makeLevel, must, TEST_CRAB_SPECS } from '../domain/test-support';
import { EventBus } from './event-bus';
import { GameFlow } from './game-flow';

function setup(levelOverrides = {}) {
  const bus = new EventBus<DomainEvent>();
  const seeds = [11, 22, 33];
  const newSeed = vi.fn(() => seeds.shift() ?? 99);
  const flow = new GameFlow({
    levels: [makeLevel(levelOverrides), makeLevel({ id: 2, ...levelOverrides })],
    crabSpecs: TEST_CRAB_SPECS,
    newSeed,
    bus,
  });
  return { flow, bus, newSeed };
}

describe('GameFlow', () => {
  it('rejects an empty campaign', () => {
    expect(
      () =>
        new GameFlow({
          levels: [],
          crabSpecs: TEST_CRAB_SPECS,
          newSeed: () => 1,
          bus: new EventBus<DomainEvent>(),
        }),
    ).toThrow(RangeError);
  });

  it('starts on the menu with no round', () => {
    const { flow } = setup();
    expect(flow.screen).toBe('menu');
    expect(flow.session).toBeUndefined();
    expect(flow.outcome).toBeUndefined();
  });

  it('plays the first level with a fresh seed and notifies listeners', () => {
    const { flow, newSeed } = setup();
    const listener = vi.fn();
    flow.onChange(listener);
    flow.play();
    expect(flow.screen).toBe('playing');
    expect(flow.levelIndex).toBe(0);
    expect(newSeed).toHaveBeenCalledTimes(1);
    expect(must(flow.session).state.status).toBe('playing');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('can play another level and rejects unknown ones', () => {
    const { flow } = setup();
    flow.play(1);
    expect(flow.levelIndex).toBe(1);
    expect(() => flow.play(5)).toThrow(RangeError);
    expect(flow.levelIndex).toBe(1);
  });

  it('pauses and resumes the round, freezing the simulation in between', () => {
    const { flow } = setup();
    flow.play();
    const session = must(flow.session);
    flow.pause();
    expect(flow.screen).toBe('paused');
    expect(session.paused).toBe(true);
    expect(session.advance(100)).toBe(0);
    flow.resume();
    expect(flow.screen).toBe('playing');
    expect(session.paused).toBe(false);
  });

  it('ignores pause/resume outside their screens', () => {
    const { flow } = setup();
    const listener = vi.fn();
    flow.onChange(listener);
    flow.pause();
    flow.resume();
    flow.togglePause();
    expect(flow.screen).toBe('menu');
    expect(listener).not.toHaveBeenCalled();
  });

  it('toggles pause', () => {
    const { flow } = setup();
    flow.play();
    flow.togglePause();
    expect(flow.screen).toBe('paused');
    flow.togglePause();
    expect(flow.screen).toBe('playing');
  });

  it('ends the round as won when the level is cleared, with the final numbers', () => {
    const { flow, bus } = setup();
    flow.play();
    bus.publish({ type: 'LevelCleared', score: 100, ammoLeft: 3 });
    expect(flow.screen).toBe('ended');
    expect(flow.outcome).toMatchObject({
      result: 'won',
      levelIndex: 0,
      score: 0,
      hits: 0,
      throws: 0,
    });
  });

  it('ends the round as lost when the flip flops run out', () => {
    const { flow, bus } = setup();
    flow.play();
    bus.publish({ type: 'RoundLost', score: 20 });
    expect(flow.screen).toBe('ended');
    expect(flow.outcome?.result).toBe('lost');
  });

  it('reads the outcome numbers from the round state', () => {
    const { flow, bus } = setup({ ammo: 5, targetScore: 10 });
    flow.play();
    must(flow.session).throwAt({ x: 10, y: 10 });
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(flow.outcome).toMatchObject({ throws: 1, hits: 0, score: 0 });
  });

  it('ignores round-ending events when no round is being played (e.g. while paused)', () => {
    const { flow, bus } = setup();
    flow.play();
    flow.pause();
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(flow.screen).toBe('paused');
    expect(flow.outcome).toBeUndefined();
  });

  it('plays again with a new seed, clearing the previous outcome', () => {
    const { flow, bus, newSeed } = setup();
    flow.play();
    bus.publish({ type: 'RoundLost', score: 0 });
    const first = must(flow.session);
    flow.play();
    expect(flow.screen).toBe('playing');
    expect(flow.outcome).toBeUndefined();
    expect(flow.session).not.toBe(first);
    expect(newSeed).toHaveBeenCalledTimes(2);
    expect(flow.levelIndex).toBe(0); // retry keeps the level
  });

  it('goes back to the menu discarding the round', () => {
    const { flow } = setup();
    flow.play();
    flow.toMenu();
    expect(flow.screen).toBe('menu');
    expect(flow.session).toBeUndefined();
  });

  it('stops notifying after unsubscribe', () => {
    const { flow } = setup();
    const listener = vi.fn();
    const off = flow.onChange(listener);
    off();
    flow.play();
    expect(listener).not.toHaveBeenCalled();
  });
});
