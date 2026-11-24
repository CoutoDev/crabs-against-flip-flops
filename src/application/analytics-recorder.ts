import type { AnalyticsPort } from './analytics';
import type { GameFlow, Screen } from './game-flow';

/** What the recorder needs to know about a level: its number and its biome (never its name). */
export interface LevelInfo {
  readonly id: number;
  readonly biome: string;
}

/**
 * Turns what happens in the game into analytics events. It only watches (the game flow and the
 * player's actions) and reports through the port; whether anything is really sent is up to the
 * port, which checks the player's consent.
 */
export class AnalyticsRecorder {
  private previous: Screen;

  constructor(
    private readonly flow: GameFlow,
    private readonly port: AnalyticsPort,
    private readonly levels: readonly LevelInfo[],
  ) {
    this.previous = flow.screen;
    flow.onChange(() => this.onScreen());
    flow.onRoundEnd((outcome) => {
      const level = this.level(outcome.levelIndex);
      const won = outcome.result === 'won';
      this.port.track({
        name: 'level_end',
        params: {
          level_id: level.id,
          biome: level.biome,
          success: won,
          score: outcome.score,
          hits: outcome.hits,
          throws: outcome.throws,
          accuracy_pct:
            outcome.throws === 0 ? 0 : Math.round((outcome.hits / outcome.throws) * 100),
          new_best: outcome.newBest,
        },
      });
      if (outcome.campaignComplete) {
        this.port.track({ name: 'campaign_complete', params: { score: outcome.score } });
      }
    });
  }

  skinBought(skinId: string, price: number): void {
    this.port.track({
      name: 'spend_virtual_currency',
      params: { value: price, virtual_currency_name: 'points', item_name: skinId },
    });
  }

  skinEquipped(skinId: string): void {
    this.port.track({ name: 'skin_equip', params: { skin_id: skinId } });
  }

  languageChanged(language: string): void {
    this.port.track({ name: 'language_change', params: { language } });
  }

  audioChanged(setting: 'sound' | 'music' | 'volume', value: number): void {
    this.port.track({ name: 'audio_change', params: { setting, value } });
  }

  private onScreen(): void {
    const before = this.previous;
    const now = this.flow.screen;
    this.previous = now;
    const level = this.level(this.flow.levelIndex);

    // A round starts when it begins to be played: from its briefing, or again from the end screen.
    // Coming back from the pause (or from the audio and language screens opened on it) is not a start.
    if (now === 'playing' && (before === 'briefing' || before === 'ended')) {
      this.port.track({ name: 'level_start', params: { level_id: level.id, biome: level.biome } });
    } else if (now === 'paused' && before === 'playing') {
      this.port.track({ name: 'game_pause', params: { level_id: level.id } });
    } else if (now === 'menu' && before === 'paused') {
      this.port.track({ name: 'level_quit', params: { level_id: level.id, biome: level.biome } });
    }
  }

  private level(index: number): LevelInfo {
    return this.levels[index] ?? { id: index + 1, biome: 'unknown' };
  }
}
