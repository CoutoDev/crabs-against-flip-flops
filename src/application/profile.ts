import type { ItemCatalog } from '../domain/entities/item';
import { bankCredit, coinsFor, convertPoints, type BankCredit } from '../domain/rules/economy';
import { buyItem, equipSkin, type ShopFailure, type ShopState } from '../domain/rules/shop';
import type { CampaignProgress } from './game-flow';
import type { Locale } from './locale';
import { sanitizePlayerName } from './player-name';
import type { ProgressRepository } from './ports/progress-repository';
import { parseSave, type SaveData, type SaveRules } from './save-data';

/** Runs `run` after `ms` milliseconds and returns a function that cancels it. */
export type Later = (run: () => void, ms: number) => () => void;

/** How long a burst of changes (typing a name, dragging the volume) waits before one single save. */
export const SAVE_DELAY_MS = 400;

/** The numbers of the economy (`data/economy.ts`), passed in so the tests can pick their own. */
export interface EconomyRules {
  readonly pointsPerCoin: number;
  /** Percent of a round's points that reach the bank when the level was already cleared. */
  readonly replayPercent: number;
}

/** What a round on a level was, for the bank. */
export interface RoundRecord {
  readonly levelId: number;
  readonly score: number;
  readonly won: boolean;
}

/**
 * The player's persistent data (name, points and coins, campaign progress, skins, settings). It is the only
 * writer of the save: every change is applied here, then stored, then listeners are told.
 */
export class Profile {
  private current: SaveData;
  private listeners: readonly (() => void)[] = [];
  private cancelPendingSave: (() => void) | undefined;

  constructor(
    private readonly repository: ProgressRepository,
    rules: SaveRules,
    private readonly catalog: ItemCatalog,
    private readonly economy: EconomyRules,
    /** Without it every change is saved at once; the browser passes a timer to coalesce bursts. */
    private readonly later?: Later,
  ) {
    this.current = parseSave(repository.load(), rules);
  }

  get data(): SaveData {
    return this.current;
  }

  /** What `GameFlow` needs to resume the campaign. */
  get progress(): CampaignProgress {
    return {
      highestUnlockedLevel: this.current.highestUnlockedLevel,
      bestScoreByLevel: this.current.bestScoreByLevel,
    };
  }

  /** Returns the unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  /**
   * End of a round: the points go to the point bank whatever the result (D12), cut by the replay
   * rule when the level was cleared before (D35), and the campaign progress is stored. Progress
   * only moves forward, so replaying an old level never loses it. Returns what reached the bank,
   * so the end-of-round dialog can say so.
   *
   * "Cleared before" is read from the save as it was before this round: the first win of a level
   * still counts in full.
   */
  recordRound(round: RoundRecord, progress: CampaignProgress): BankCredit {
    const best: Record<number, number> = { ...this.current.bestScoreByLevel };
    for (const [key, value] of Object.entries(progress.bestScoreByLevel)) {
      const id = Number(key);
      if (value > (best[id] ?? 0)) best[id] = value;
    }
    const cleared = this.current.clearedLevels;
    const credit = bankCredit(
      round.score,
      cleared.includes(round.levelId),
      this.economy.replayPercent,
    );
    this.update({
      points: this.current.points + credit.points,
      clearedLevels:
        round.won && !cleared.includes(round.levelId)
          ? [...cleared, round.levelId].sort((a, b) => a - b)
          : cleared,
      highestUnlockedLevel: Math.max(
        this.current.highestUnlockedLevel,
        progress.highestUnlockedLevel,
      ),
      bestScoreByLevel: best,
    });
    return credit;
  }

  /** How many coins the whole point bank is worth right now. */
  get convertibleCoins(): number {
    return coinsFor(this.current.points, this.economy.pointsPerCoin);
  }

  /**
   * Turns as many points as make whole coins into coins; the rest stays in the bank. Returns how
   * many coins were added (0 when the bank is below one coin's worth, and nothing is stored).
   */
  convertAll(): number {
    const { points, coins } = this.current;
    const result = convertPoints({ points, coins }, points, this.economy.pointsPerCoin);
    if (!result.ok) return 0;
    this.update(result.wallet);
    return result.converted;
  }

  /** Returns why it failed, or `undefined` on success. */
  buy(skinId: string): ShopFailure | undefined {
    return this.shop(buyItem(this.shopState(), this.catalog, skinId));
  }

  equip(skinId: string): ShopFailure | undefined {
    return this.shop(equipSkin(this.shopState(), this.catalog, skinId));
  }

  /** Stores the cleaned name and returns it (the input shows what was really kept). */
  setPlayerName(name: string): string {
    const playerName = sanitizePlayerName(name);
    if (playerName !== this.current.playerName) this.update({ playerName });
    else this.flush(); // typed already (kept in memory): committing it means saving it now
    return playerName;
  }

  /** The name while it is being typed: kept in memory at once, saved once the typing pauses. */
  typePlayerName(name: string): void {
    const playerName = sanitizePlayerName(name);
    if (playerName !== this.current.playerName) this.update({ playerName }, 'later');
  }

  /** Writes any change that is still waiting. Call it when the page is being left. */
  flush(): void {
    if (this.cancelPendingSave === undefined) return;
    this.cancelPendingSave();
    this.cancelPendingSave = undefined;
    this.repository.save(this.current);
  }

  setLocale(locale: Locale): void {
    if (this.current.settings.locale !== locale) {
      this.update({ settings: { ...this.current.settings, locale } });
    }
  }

  setMuted(muted: boolean): void {
    if (this.current.settings.muted !== muted) {
      this.update({ settings: { ...this.current.settings, muted } });
    }
  }

  setMusic(music: boolean): void {
    if (this.current.settings.music !== music) {
      this.update({ settings: { ...this.current.settings, music } });
    }
  }

  /** Clamped to 0..1. */
  setVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
    if (this.current.settings.volume !== clamped) {
      this.update({ settings: { ...this.current.settings, volume: clamped } }, 'later');
    }
  }

  private shopState(): ShopState {
    const { coins, ownedSkins, equippedSkin } = this.current;
    return { coins, ownedSkins, equippedSkin };
  }

  private shop(result: ReturnType<typeof buyItem>): ShopFailure | undefined {
    if (!result.ok) return result.reason;
    this.update(result.state);
    return undefined;
  }

  /**
   * `'now'` saves at once (and also what was waiting: it is the same snapshot); `'later'` saves
   * after a pause in the changes. Listeners hear about it either way, so the UI never lags.
   */
  private update(changes: Partial<SaveData>, when: 'now' | 'later' = 'now'): void {
    this.current = { ...this.current, ...changes };
    this.cancelPendingSave?.();
    this.cancelPendingSave = undefined;
    if (when === 'later' && this.later !== undefined) {
      this.cancelPendingSave = this.later(() => {
        this.cancelPendingSave = undefined;
        this.repository.save(this.current);
      }, SAVE_DELAY_MS);
    } else {
      this.repository.save(this.current);
    }
    for (const listener of this.listeners) listener();
  }
}
