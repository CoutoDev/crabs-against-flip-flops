import type { SkinCatalog } from '../domain/entities/skin';
import { buySkin, equipSkin, type ShopFailure, type ShopState } from '../domain/rules/shop';
import type { CampaignProgress } from './game-flow';
import type { Locale } from './locale';
import { sanitizePlayerName } from './player-name';
import type { ProgressRepository } from './ports/progress-repository';
import { parseSave, type SaveDataV1, type SaveRules } from './save-data';

/** Runs `run` after `ms` milliseconds and returns a function that cancels it. */
export type Later = (run: () => void, ms: number) => () => void;

/** How long a burst of changes (typing a name, dragging the volume) waits before one single save. */
export const SAVE_DELAY_MS = 400;

/**
 * The player's persistent data (name, points, campaign progress, skins, settings). It is the only
 * writer of the save: every change is applied here, then stored, then listeners are told.
 */
export class Profile {
  private current: SaveDataV1;
  private listeners: readonly (() => void)[] = [];
  private cancelPendingSave: (() => void) | undefined;

  constructor(
    private readonly repository: ProgressRepository,
    rules: SaveRules,
    private readonly catalog: SkinCatalog,
    /** Without it every change is saved at once; the browser passes a timer to coalesce bursts. */
    private readonly later?: Later,
  ) {
    this.current = parseSave(repository.load(), rules);
  }

  get data(): SaveDataV1 {
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
   * End of a round: the points go to the balance whatever the result (D12) and the campaign
   * progress is stored. Progress only moves forward, so replaying an old level never loses it.
   */
  recordRound(score: number, progress: CampaignProgress): void {
    const best: Record<number, number> = { ...this.current.bestScoreByLevel };
    for (const [key, value] of Object.entries(progress.bestScoreByLevel)) {
      const id = Number(key);
      if (value > (best[id] ?? 0)) best[id] = value;
    }
    this.update({
      balance: this.current.balance + Math.max(0, Math.floor(score)),
      highestUnlockedLevel: Math.max(
        this.current.highestUnlockedLevel,
        progress.highestUnlockedLevel,
      ),
      bestScoreByLevel: best,
    });
  }

  /** Returns why it failed, or `undefined` on success. */
  buy(skinId: string): ShopFailure | undefined {
    return this.shop(buySkin(this.shopState(), this.catalog, skinId));
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
    const { balance, ownedSkins, equippedSkin } = this.current;
    return { balance, ownedSkins, equippedSkin };
  }

  private shop(result: ReturnType<typeof buySkin>): ShopFailure | undefined {
    if (!result.ok) return result.reason;
    this.update(result.state);
    return undefined;
  }

  /**
   * `'now'` saves at once (and also what was waiting: it is the same snapshot); `'later'` saves
   * after a pause in the changes. Listeners hear about it either way, so the UI never lags.
   */
  private update(changes: Partial<SaveDataV1>, when: 'now' | 'later' = 'now'): void {
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
