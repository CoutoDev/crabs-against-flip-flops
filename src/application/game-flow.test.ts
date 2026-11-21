import { describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '../domain/events';
import { makeLevel, must, TEST_CRAB_SPECS } from '../domain/test-support';
import { EventBus } from './event-bus';
import { GameFlow, type CampaignProgress } from './game-flow';

/** Opens a level and gets past its briefing, as a player pressing Start would. */
function begin(flow: GameFlow, levelIndex?: number): void {
  flow.play(levelIndex);
  flow.start();
}

function setup(levelOverrides = {}, progress?: CampaignProgress) {
  const bus = new EventBus<DomainEvent>();
  const seeds = [11, 22, 33];
  const newSeed = vi.fn(() => seeds.shift() ?? 99);
  const flow = new GameFlow({
    levels: [
      makeLevel(levelOverrides),
      makeLevel({ id: 2, ...levelOverrides }),
      makeLevel({ id: 3, ...levelOverrides }),
    ],
    crabSpecs: TEST_CRAB_SPECS,
    newSeed,
    bus,
    progress,
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

  it('opens the first level on a briefing with a frozen round and a fresh seed', () => {
    const { flow, newSeed } = setup();
    const listener = vi.fn();
    flow.onChange(listener);
    flow.play();
    expect(flow.screen).toBe('briefing');
    expect(flow.levelIndex).toBe(0);
    expect(newSeed).toHaveBeenCalledTimes(1);
    const session = must(flow.session);
    expect(session.paused).toBe(true);
    expect(session.advance(1000)).toBe(0); // nothing moves while the player reads
    expect(session.state.timeMs).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('start() ends the briefing and lets the round run', () => {
    const { flow } = setup();
    flow.play();
    flow.start();
    expect(flow.screen).toBe('playing');
    const session = must(flow.session);
    expect(session.paused).toBe(false);
    expect(session.advance(100)).toBeGreaterThan(0);
  });

  it('start() does nothing outside a briefing', () => {
    const { flow } = setup();
    const listener = vi.fn();
    flow.onChange(listener);
    flow.start();
    expect(flow.screen).toBe('menu');
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not end a round while it is still on the briefing', () => {
    const { flow, bus } = setup();
    flow.play();
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(flow.screen).toBe('briefing');
  });

  it('retry() replays the same level straight away, with a new seed and no briefing', () => {
    const { flow, bus, newSeed } = setup({}, { highestUnlockedLevel: 2, bestScoreByLevel: {} });
    begin(flow, 1);
    bus.publish({ type: 'RoundLost', score: 0 });
    flow.retry();
    expect(flow.screen).toBe('playing');
    expect(flow.levelIndex).toBe(1);
    expect(flow.outcome).toBeUndefined();
    expect(must(flow.session).paused).toBe(false);
    expect(newSeed).toHaveBeenCalledTimes(2);
  });

  it('can leave a briefing for the menu', () => {
    const { flow } = setup();
    flow.play();
    flow.toMenu();
    expect(flow.screen).toBe('menu');
    expect(flow.session).toBeUndefined();
  });

  it('can play an unlocked level and rejects unknown ones', () => {
    const { flow } = setup({}, { highestUnlockedLevel: 2, bestScoreByLevel: {} });
    begin(flow, 1);
    expect(flow.levelIndex).toBe(1);
    expect(() => flow.play(5)).toThrow(RangeError);
    expect(() => flow.play(-1)).toThrow(RangeError);
    expect(flow.levelIndex).toBe(1);
  });

  it('pauses and resumes the round, freezing the simulation in between', () => {
    const { flow } = setup();
    begin(flow);
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
    begin(flow);
    flow.togglePause();
    expect(flow.screen).toBe('paused');
    flow.togglePause();
    expect(flow.screen).toBe('playing');
  });

  it('ends the round as won when the level is cleared, with the final numbers', () => {
    const { flow, bus } = setup();
    begin(flow);
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
    begin(flow);
    bus.publish({ type: 'RoundLost', score: 20 });
    expect(flow.screen).toBe('ended');
    expect(flow.outcome?.result).toBe('lost');
  });

  it('reads the outcome numbers from the round state', () => {
    const { flow, bus } = setup({ ammo: 5, targetScore: 10 });
    begin(flow);
    must(flow.session).throwAt({ x: 10, y: 10 });
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(flow.outcome).toMatchObject({ throws: 1, hits: 0, score: 0 });
  });

  it('ignores round-ending events when no round is being played (e.g. while paused)', () => {
    const { flow, bus } = setup();
    begin(flow);
    flow.pause();
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(flow.screen).toBe('paused');
    expect(flow.outcome).toBeUndefined();
  });

  it('plays again with a new seed, clearing the previous outcome', () => {
    const { flow, bus, newSeed } = setup();
    begin(flow);
    bus.publish({ type: 'RoundLost', score: 0 });
    const first = must(flow.session);
    begin(flow);
    expect(flow.screen).toBe('playing');
    expect(flow.outcome).toBeUndefined();
    expect(flow.session).not.toBe(first);
    expect(newSeed).toHaveBeenCalledTimes(2);
    expect(flow.levelIndex).toBe(0); // retry keeps the level
  });

  it('goes back to the menu discarding the round', () => {
    const { flow } = setup();
    begin(flow);
    flow.toMenu();
    expect(flow.screen).toBe('menu');
    expect(flow.session).toBeUndefined();
  });

  it('stops notifying after unsubscribe', () => {
    const { flow } = setup();
    const listener = vi.fn();
    const off = flow.onChange(listener);
    off();
    begin(flow);
    expect(listener).not.toHaveBeenCalled();
  });

  describe('campaign progression', () => {
    /** Clears the level being played by publishing the domain event, as the round would. */
    const win = (bus: EventBus<DomainEvent>) =>
      bus.publish({ type: 'LevelCleared', score: 100, ammoLeft: 3 });
    const lose = (bus: EventBus<DomainEvent>) => bus.publish({ type: 'RoundLost', score: 0 });

    it('starts with only the first level unlocked', () => {
      const { flow } = setup();
      expect(flow.highestUnlockedIndex).toBe(0);
      expect(flow.progress).toEqual({ highestUnlockedLevel: 1, bestScoreByLevel: {} });
      expect(() => flow.play(1)).toThrow(RangeError);
    });

    it('opens on the furthest unlocked level when progress is restored', () => {
      const { flow } = setup({}, { highestUnlockedLevel: 3, bestScoreByLevel: { 1: 120 } });
      expect(flow.highestUnlockedIndex).toBe(2);
      expect(flow.levelIndex).toBe(2);
      expect(flow.progress.bestScoreByLevel).toEqual({ 1: 120 });
    });

    it('clamps restored progress to levels that exist', () => {
      expect(
        setup({}, { highestUnlockedLevel: 99, bestScoreByLevel: {} }).flow.highestUnlockedIndex,
      ).toBe(2);
      expect(
        setup({}, { highestUnlockedLevel: 0, bestScoreByLevel: {} }).flow.highestUnlockedIndex,
      ).toBe(0);
    });

    it('unlocks the next level when the frontier level is won', () => {
      const { flow, bus } = setup();
      begin(flow);
      win(bus);
      expect(flow.highestUnlockedIndex).toBe(1);
      expect(flow.progress.highestUnlockedLevel).toBe(2);
      expect(flow.outcome).toMatchObject({
        result: 'won',
        nextLevelIndex: 1,
        campaignComplete: false,
      });
    });

    it('does not unlock anything on a loss', () => {
      const { flow, bus } = setup();
      begin(flow);
      lose(bus);
      expect(flow.highestUnlockedIndex).toBe(0);
      expect(flow.outcome).toMatchObject({ result: 'lost', nextLevelIndex: undefined });
    });

    it('does not move the frontier back when an earlier level is replayed and won', () => {
      const { flow, bus } = setup({}, { highestUnlockedLevel: 3, bestScoreByLevel: {} });
      begin(flow, 0);
      win(bus);
      expect(flow.highestUnlockedIndex).toBe(2);
      expect(flow.outcome?.nextLevelIndex).toBe(1);
    });

    it('goes to the next level, with a fresh round', () => {
      const { flow, bus, newSeed } = setup();
      begin(flow);
      win(bus);
      flow.next();
      expect(flow.screen).toBe('briefing'); // each new level opens with its briefing
      expect(flow.levelIndex).toBe(1);
      expect(flow.outcome).toBeUndefined();
      expect(newSeed).toHaveBeenCalledTimes(2);
    });

    it('ignores next() when there is nothing to advance to', () => {
      const { flow, bus } = setup();
      const listener = vi.fn();
      flow.onChange(listener);
      flow.next(); // on the menu
      begin(flow);
      lose(bus);
      listener.mockClear();
      flow.next(); // lost: the level is not cleared
      expect(flow.screen).toBe('ended');
      expect(flow.levelIndex).toBe(0);
      expect(listener).not.toHaveBeenCalled();
    });

    it('flags the campaign as complete when the last level is won, and has no next level', () => {
      const { flow, bus } = setup({}, { highestUnlockedLevel: 3, bestScoreByLevel: {} });
      begin(flow, 2);
      win(bus);
      expect(flow.highestUnlockedIndex).toBe(2);
      expect(flow.outcome).toMatchObject({
        result: 'won',
        nextLevelIndex: undefined,
        campaignComplete: true,
      });
      flow.next();
      expect(flow.screen).toBe('ended');
    });

    it('keeps the best score of each level, on a win or a loss', () => {
      const { flow, bus } = setup({
        spawn: { intervalMs: { min: 1, max: 1 }, maxOnScreen: 1, laneY: { min: 100, max: 100 } },
        crabs: [{ type: 'common', weight: 1, speedPxPerSec: { min: 100, max: 100 } }],
        throw: { speedPxPerSec: 100000, minFlightMs: 1, maxFlightMs: 1, arcHeightPx: 0 },
      });
      const hitOnce = () => {
        const session = must(flow.session);
        // Wait for a crab to walk onto the field, then land right on it (the flight takes 1 ms).
        for (
          let i = 0;
          i < 200 && !session.state.crabs.some((c) => c.x > 20 && c.x < 160);
          i += 1
        ) {
          session.advance(50);
        }
        const crab = must(session.state.crabs.find((c) => c.x > 20 && c.x < 160));
        session.throwAt({ x: crab.x, y: crab.y });
        session.advance(50);
        expect(session.state.score).toBe(10);
      };

      begin(flow);
      hitOnce();
      lose(bus);
      expect(flow.progress.bestScoreByLevel).toEqual({ 1: 10 });

      begin(flow);
      lose(bus); // 0 points this time: the best must not go down
      expect(flow.progress.bestScoreByLevel).toEqual({ 1: 10 });
    });

    it('selects an unlocked level from the menu and refuses locked ones', () => {
      const { flow } = setup({}, { highestUnlockedLevel: 2, bestScoreByLevel: {} });
      flow.select(0);
      expect(flow.levelIndex).toBe(0);
      expect(() => flow.select(2)).toThrow(RangeError);
      expect(flow.levelIndex).toBe(0);
    });

    it('notifies listeners when the selection changes', () => {
      const { flow } = setup({}, { highestUnlockedLevel: 2, bestScoreByLevel: {} });
      const listener = vi.fn();
      flow.onChange(listener);
      flow.select(0);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('only selects while on the menu', () => {
      const { flow } = setup({}, { highestUnlockedLevel: 2, bestScoreByLevel: {} });
      begin(flow, 0);
      flow.select(1);
      expect(flow.levelIndex).toBe(0);
    });

    it('after winning, the menu offers the level that was just unlocked', () => {
      const { flow, bus } = setup();
      begin(flow);
      win(bus);
      flow.toMenu();
      expect(flow.levelIndex).toBe(1);
    });

    it('after losing, the menu keeps the level that was being played', () => {
      const { flow, bus } = setup({}, { highestUnlockedLevel: 3, bestScoreByLevel: {} });
      begin(flow, 1);
      lose(bus);
      flow.toMenu();
      expect(flow.levelIndex).toBe(1);
    });
  });

  describe('round end listeners and the shop', () => {
    it('tells the round end listeners once, with the outcome, before the end screen', () => {
      const { flow, bus } = setup();
      const seen: string[] = [];
      flow.onRoundEnd((outcome) =>
        seen.push(`${outcome.result}:${flow.screen}:${flow.progress.highestUnlockedLevel}`),
      );
      begin(flow);
      bus.publish({ type: 'LevelCleared', score: 100, ammoLeft: 3 });
      // The screen is still "playing" when listeners run, and progress already has the unlock.
      expect(seen).toEqual(['won:playing:2']);
    });

    it('stops telling a listener after it unsubscribes', () => {
      const { flow, bus } = setup();
      const listener = vi.fn();
      flow.onRoundEnd(listener)();
      begin(flow);
      bus.publish({ type: 'RoundLost', score: 0 });
      expect(listener).not.toHaveBeenCalled();
    });

    it('opens the shop from the menu and closes it back to the menu', () => {
      const { flow } = setup();
      flow.openShop();
      expect(flow.screen).toBe('shop');
      flow.closeShop();
      expect(flow.screen).toBe('menu');
    });

    it('opens the shop only from the menu', () => {
      const { flow } = setup();
      begin(flow);
      flow.openShop();
      expect(flow.screen).toBe('playing');
      flow.closeShop();
      expect(flow.screen).toBe('playing');
    });
  });

  describe('best score in the outcome', () => {
    const levelWithEasyHits = {
      spawn: { intervalMs: { min: 1, max: 1 }, maxOnScreen: 1, laneY: { min: 100, max: 100 } },
      crabs: [{ type: 'common' as const, weight: 1, speedPxPerSec: { min: 100, max: 100 } }],
      throw: { speedPxPerSec: 100000, minFlightMs: 1, maxFlightMs: 1, arcHeightPx: 0 },
    };
    const hitOnce = (flow: GameFlow) => {
      const session = must(flow.session);
      for (let i = 0; i < 200 && !session.state.crabs.some((c) => c.x > 20 && c.x < 160); i += 1) {
        session.advance(50);
      }
      const crab = must(session.state.crabs.find((c) => c.x > 20 && c.x < 160));
      session.throwAt({ x: crab.x, y: crab.y });
      session.advance(50);
    };

    it('reports the score as the best on the first round, without calling it a record', () => {
      const { flow, bus } = setup(levelWithEasyHits);
      begin(flow);
      hitOnce(flow);
      bus.publish({ type: 'RoundLost', score: 10 });
      expect(flow.outcome).toMatchObject({ score: 10, bestScore: 10, newBest: false });
    });

    it('flags a round that beats the previous best, and keeps the old best otherwise', () => {
      const { flow, bus } = setup(levelWithEasyHits, {
        highestUnlockedLevel: 1,
        bestScoreByLevel: { 1: 5 },
      });
      begin(flow);
      hitOnce(flow);
      bus.publish({ type: 'RoundLost', score: 10 });
      expect(flow.outcome).toMatchObject({ bestScore: 10, newBest: true });

      flow.retry();
      bus.publish({ type: 'RoundLost', score: 0 });
      expect(flow.outcome).toMatchObject({ score: 0, bestScore: 10, newBest: false });
    });
  });
});
