import type { CrabType } from '../domain/entities/crab';
import type { ItemCatalog } from '../domain/entities/item';
import { bankCredit, coinsFor, convertPoints, type BankCredit } from '../domain/rules/economy';
import { buyItem, equipSkin, type ShopFailure, type ShopState } from '../domain/rules/shop';
import {
  evaluateAchievements,
  progressOf,
  type AchievementCatalog,
  type AchievementContext,
  type Progress,
} from './achievements';
import type { CampaignProgress } from './game-flow';
import type { Locale } from './locale';
import { sanitizePlayerName } from './player-name';
import type { ProgressRepository } from './ports/progress-repository';
import { parseSave, type PlayerStats, type SaveData, type SaveRules } from './save-data';

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

/** The achievements of this build and the campaign they are measured on. */
export interface AchievementRules {
  readonly catalog: AchievementCatalog;
  readonly levels: AchievementContext['levels'];
}

/** What a round was: for the bank, the lifetime counters and the achievements. */
export interface RoundRecord {
  readonly levelId: number;
  /** Full points of the round, before the replay cut. */
  readonly score: number;
  readonly won: boolean;
  readonly hits: number;
  readonly throws: number;
  /** Throws that landed without hitting a crab. */
  readonly misses: number;
  readonly bestCombo: number;
  readonly hitsByType: Readonly<Record<CrabType, number>>;
  /** Flip flops not thrown when the round ended. */
  readonly ammoLeft: number;
}

/** An achievement earned by a round, with what it paid. */
export interface Unlock {
  readonly id: string;
  readonly coins: number;
  /** Items it unlocked (they are now owned). */
  readonly items: readonly string[];
}

export interface RoundResult {
  readonly credit: BankCredit;
  readonly unlocked: readonly Unlock[];
}

/** Lifetime counters stop here, like every number of the save. */
const MAX_COUNT = 1_000_000_000;
/** Adds to a counter: whole numbers only, never below zero, never past the cap. */
const add = (total: number, amount: number): number =>
  Math.min(MAX_COUNT, total + (Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0));

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
    private readonly achievements: AchievementRules,
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
   * rule when the level was cleared before (D38), and the campaign progress is stored. Progress
   * only moves forward, so replaying an old level never loses it. Returns what reached the bank,
   * so the end-of-round dialog can say so.
   *
   * "Cleared before" is read from the save as it was before this round: the first win of a level
   * still counts in full.
   *
   * The round also feeds the lifetime counters and, in the same single save, earns the
   * achievements it completes: their coins are paid and the items they unlock become owned
   * (D36). Earning is permanent, so replaying never pays twice.
   */
  recordRound(round: RoundRecord, progress: CampaignProgress): RoundResult {
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
    const clearedLevels =
      round.won && !cleared.includes(round.levelId)
        ? [...cleared, round.levelId].sort((a, b) => a - b)
        : cleared;
    const stats = this.statsAfter(round);
    const unlocked = this.unlocksFor({ stats, clearedLevels, levels: this.achievements.levels });
    const owned = [...this.current.ownedSkins];
    for (const unlock of unlocked) {
      for (const item of unlock.items) if (!owned.includes(item)) owned.push(item);
    }
    this.update({
      points: this.current.points + credit.points,
      coins: this.current.coins + unlocked.reduce((sum, unlock) => sum + unlock.coins, 0),
      clearedLevels,
      highestUnlockedLevel: Math.max(
        this.current.highestUnlockedLevel,
        progress.highestUnlockedLevel,
      ),
      bestScoreByLevel: best,
      stats,
      achievements: this.achievements.catalog
        .map((entry) => entry.id)
        .filter(
          (id) =>
            this.current.achievements.includes(id) || unlocked.some((unlock) => unlock.id === id),
        ),
      ownedSkins: owned,
    });
    return { credit, unlocked };
  }

  /** Where every achievement stands, in catalog order (for the achievements screen). */
  achievementProgress(): readonly {
    readonly id: string;
    readonly earned: boolean;
    readonly progress: Progress;
  }[] {
    const context = this.context();
    return this.achievements.catalog.map((entry) => ({
      id: entry.id,
      earned: this.current.achievements.includes(entry.id),
      progress: progressOf(entry.condition, context),
    }));
  }

  private context(): AchievementContext {
    return {
      stats: this.current.stats,
      clearedLevels: this.current.clearedLevels,
      levels: this.achievements.levels,
    };
  }

  private statsAfter(round: RoundRecord): PlayerStats {
    const stats = this.current.stats;
    const hitsByType = { ...stats.hitsByType };
    for (const type of Object.keys(hitsByType) as CrabType[]) {
      hitsByType[type] = add(hitsByType[type], round.hitsByType[type] ?? 0);
    }
    return {
      rounds: add(stats.rounds, 1),
      wins: add(stats.wins, round.won ? 1 : 0),
      throws: add(stats.throws, round.throws),
      hits: add(stats.hits, round.hits),
      bestCombo: Math.max(stats.bestCombo, add(0, round.bestCombo)),
      flawlessWins: add(stats.flawlessWins, round.won && round.misses === 0 ? 1 : 0),
      bestAmmoLeftOnWin: round.won
        ? Math.max(stats.bestAmmoLeftOnWin, add(0, round.ammoLeft))
        : stats.bestAmmoLeftOnWin,
      totalPoints: add(stats.totalPoints, round.score),
      hitsByType,
    };
  }

  /** The achievements this context completes that were not earned yet, with their rewards. */
  private unlocksFor(context: AchievementContext): readonly Unlock[] {
    return evaluateAchievements(this.achievements.catalog, context, this.current.achievements).map(
      (id) => ({
        id,
        coins: this.achievements.catalog.find((entry) => entry.id === id)?.coins ?? 0,
        items: this.catalog.flatMap((item) =>
          'achievement' in item.acquire && item.acquire.achievement === id ? [item.id] : [],
        ),
      }),
    );
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
