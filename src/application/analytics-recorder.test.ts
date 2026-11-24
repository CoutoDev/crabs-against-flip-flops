import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../domain/events';
import { makeLevel, TEST_CRAB_SPECS } from '../domain/test-support';
import type { AnalyticsEvent, AnalyticsPort } from './analytics';
import { AnalyticsRecorder } from './analytics-recorder';
import { EventBus } from './event-bus';
import { GameFlow } from './game-flow';

function setup() {
  const bus = new EventBus<DomainEvent>();
  const flow = new GameFlow({
    levels: [makeLevel({ id: 1 }), makeLevel({ id: 2 })],
    crabSpecs: TEST_CRAB_SPECS,
    newSeed: () => 1,
    bus,
    progress: { highestUnlockedLevel: 2, bestScoreByLevel: {} },
  });
  const events: AnalyticsEvent[] = [];
  const port: AnalyticsPort = { track: (event) => void events.push(event) };
  const recorder = new AnalyticsRecorder(flow, port, [
    { id: 1, biome: 'beach' },
    { id: 2, biome: 'rocks' },
  ]);
  const names = () => events.map((event) => event.name);
  return { flow, bus, recorder, events, names };
}

describe('AnalyticsRecorder', () => {
  it('says nothing while the player only browses the menu, shop, audio and language', () => {
    const { flow, names } = setup();
    flow.openShop();
    flow.closeShop();
    flow.openAudio();
    flow.openLanguage();
    flow.closeSettings();
    flow.select(1);
    expect(names()).toEqual([]);
  });

  it('level_start fires when the round is really played, not on the briefing', () => {
    const { flow, events } = setup();
    flow.play(1);
    expect(events).toEqual([]);
    flow.start();
    expect(events).toEqual([{ name: 'level_start', params: { level_id: 2, biome: 'rocks' } }]);
  });

  it('level_start fires again on retry (end screen to playing) and on the next level', () => {
    const { flow, bus, names } = setup();
    flow.play(0);
    flow.start();
    bus.publish({ type: 'RoundLost', score: 0 });
    flow.retry();
    expect(names().filter((name) => name === 'level_start')).toHaveLength(2);
    bus.publish({ type: 'LevelCleared', score: 5, ammoLeft: 1 });
    flow.next();
    flow.start();
    expect(names().filter((name) => name === 'level_start')).toHaveLength(3);
  });

  it('pausing, resuming and visiting audio or language on the pause is not a new start', () => {
    const { flow, names } = setup();
    flow.play(0);
    flow.start();
    flow.pause();
    flow.openAudio();
    flow.closeSettings();
    flow.openLanguage();
    flow.closeSettings();
    flow.resume();
    expect(names()).toEqual(['level_start', 'game_pause']);
  });

  it('level_quit fires when a running round is left from the pause', () => {
    const { flow, events } = setup();
    flow.play(0);
    flow.start();
    flow.pause();
    flow.toMenu();
    expect(events.at(-1)).toEqual({ name: 'level_quit', params: { level_id: 1, biome: 'beach' } });
  });

  it('leaving the briefing or the end screen for the menu is not a quit', () => {
    const { flow, bus, names } = setup();
    flow.play(0);
    flow.toMenu();
    flow.play(0);
    flow.start();
    bus.publish({ type: 'RoundLost', score: 0 });
    flow.toMenu();
    expect(names()).not.toContain('level_quit');
  });

  it('level_end carries the result with a fixed set of keys', () => {
    const { flow, bus, events } = setup();
    flow.play(0);
    flow.start();
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(events.at(-1)).toEqual({
      name: 'level_end',
      params: {
        level_id: 1,
        biome: 'beach',
        success: false,
        score: 0,
        hits: 0,
        throws: 0,
        accuracy_pct: 0,
        new_best: false,
      },
    });
  });

  it('a win on the last level also reports campaign_complete', () => {
    const { flow, bus, names } = setup();
    flow.play(1);
    flow.start();
    bus.publish({ type: 'LevelCleared', score: 7, ammoLeft: 3 });
    expect(names().slice(-2)).toEqual(['level_end', 'campaign_complete']);
  });

  it('reports the player actions with ids and numbers only', () => {
    const { recorder, events } = setup();
    recorder.skinBought('ocean', 75);
    recorder.skinEquipped('ocean');
    recorder.languageChanged('pt-BR');
    recorder.audioChanged('volume', 40);
    expect(events).toEqual([
      {
        name: 'spend_virtual_currency',
        params: { value: 75, virtual_currency_name: 'points', item_name: 'ocean' },
      },
      { name: 'skin_equip', params: { skin_id: 'ocean' } },
      { name: 'language_change', params: { language: 'pt-BR' } },
      { name: 'audio_change', params: { setting: 'volume', value: 40 } },
    ]);
  });
});
