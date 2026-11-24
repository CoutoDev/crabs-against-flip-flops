import type { CrabSpecs } from '../domain/entities/crab';
import type { LevelConfig } from '../domain/entities/level';
import type { DomainEvent } from '../domain/events';
import type { EventBus } from './event-bus';
import { GameSession } from './game-session';

export type Screen =
  | 'menu'
  | 'shop'
  | 'achievements'
  | 'audio'
  | 'language'
  | 'briefing'
  | 'playing'
  | 'paused'
  | 'ended';

/** Where the audio and language screens can be opened from, and where their Back button returns. */
export type SettingsOrigin = 'menu' | 'paused';

export interface RoundOutcome {
  readonly result: 'won' | 'lost';
  readonly levelIndex: number;
  readonly score: number;
  readonly hits: number;
  readonly throws: number;
  /** Flip flops not thrown when the round ended (what a win "saved"). */
  readonly ammoLeft: number;
  /** Best score on this level, this round included. */
  readonly bestScore: number;
  /** True when this round beat the previous best of the level (and there was one to beat). */
  readonly newBest: boolean;
  /** Where "Next level" goes: set only after a win that is not on the last level. */
  readonly nextLevelIndex: number | undefined;
  /** True when the last level of the campaign was just won. */
  readonly campaignComplete: boolean;
}

/**
 * What the campaign remembers between rounds. It has the shape of the persisted save (ADR section 5),
 * keyed by level id, so the progress repository (M4) can store and restore it as is.
 */
export interface CampaignProgress {
  readonly highestUnlockedLevel: number;
  readonly bestScoreByLevel: Readonly<Record<number, number>>;
}

export interface GameFlowDeps {
  readonly levels: readonly LevelConfig[];
  readonly crabSpecs: CrabSpecs;
  /** Impure on purpose: the composition root provides randomness, the application layer stays pure. */
  readonly newSeed: () => number;
  readonly bus: EventBus<DomainEvent>;
  /** Restored progress; a new player starts with only the first level unlocked. */
  readonly progress?: CampaignProgress | undefined;
}

/**
 * Which screen the player is on, and the round that belongs to it. It is the only place that
 * knows how a round ends; UI and input just ask it to change screens.
 */
export class GameFlow {
  private current: Screen = 'menu';
  private origin: SettingsOrigin = 'menu';
  private currentSession: GameSession | undefined;
  private currentOutcome: RoundOutcome | undefined;
  private currentLevelIndex = 0;
  private frontierIndex = 0;
  private bestScores: Readonly<Record<number, number>> = {};
  private listeners: readonly (() => void)[] = [];
  private roundEndListeners: readonly ((outcome: RoundOutcome) => void)[] = [];
  private roundStartListeners: readonly (() => void)[] = [];

  constructor(private readonly deps: GameFlowDeps) {
    if (deps.levels.length === 0) throw new RangeError('GameFlow needs at least one level');
    const saved = deps.progress;
    if (saved !== undefined) {
      const lastIndex = deps.levels.length - 1;
      // Furthest level whose id the save has reached; ids outside the campaign are clamped.
      const reached = deps.levels.filter((level) => level.id <= saved.highestUnlockedLevel).length;
      this.frontierIndex = Math.min(Math.max(reached - 1, 0), lastIndex);
      this.bestScores = { ...saved.bestScoreByLevel };
      this.currentLevelIndex = this.frontierIndex; // "Play" continues where the player stopped
    }
    deps.bus.subscribe((event) => this.onEvent(event));
  }

  get screen(): Screen {
    return this.current;
  }

  /** The round in progress (also available behind the pause and end overlays). */
  get session(): GameSession | undefined {
    return this.currentSession;
  }

  get outcome(): RoundOutcome | undefined {
    return this.currentOutcome;
  }

  /** The level being played or, on the menu, the one that "Play" will start. */
  get levelIndex(): number {
    return this.currentLevelIndex;
  }

  /** Index of the furthest level the player may play. */
  get highestUnlockedIndex(): number {
    return this.frontierIndex;
  }

  get progress(): CampaignProgress {
    return {
      highestUnlockedLevel: this.deps.levels[this.frontierIndex]?.id ?? 1,
      bestScoreByLevel: this.bestScores,
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
   * Called once when a round ends (won or lost), after the campaign progress was updated, so
   * `progress` already includes the result. Returns the unsubscribe function.
   */
  onRoundEnd(listener: (outcome: RoundOutcome) => void): () => void {
    this.roundEndListeners = [...this.roundEndListeners, listener];
    return () => {
      this.roundEndListeners = this.roundEndListeners.filter((candidate) => candidate !== listener);
    };
  }

  /**
   * Called each time a new round is created (from the briefing, a retry or the next level), before
   * anything of it can happen. Whatever counts a round's events starts from zero here. Returns the
   * unsubscribe function.
   */
  onRoundStart(listener: () => void): () => void {
    this.roundStartListeners = [...this.roundStartListeners, listener];
    return () => {
      this.roundStartListeners = this.roundStartListeners.filter(
        (candidate) => candidate !== listener,
      );
    };
  }

  /** The screen the audio and language screens go back to (meaningful while one of them is open). */
  get settingsOrigin(): SettingsOrigin {
    return this.origin;
  }

  /**
   * The audio and language screens are reached from the main menu or from the pause screen. They
   * never touch the round: a paused round stays paused underneath and Back returns to the pause.
   */
  openAudio(): void {
    this.openSettings('audio');
  }

  openLanguage(): void {
    this.openSettings('language');
  }

  closeSettings(): void {
    if (this.current !== 'audio' && this.current !== 'language') return;
    this.go(this.origin);
  }

  /** The shop is reached from the menu and goes back to it. */
  openShop(): void {
    if (this.current !== 'menu') return;
    this.go('shop');
  }

  closeShop(): void {
    if (this.current !== 'shop') return;
    this.go('menu');
  }

  /** The achievements screen is reached from the menu and goes back to it. */
  openAchievements(): void {
    if (this.current !== 'menu') return;
    this.go('achievements');
  }

  closeAchievements(): void {
    if (this.current !== 'achievements') return;
    this.go('menu');
  }

  /** Chooses which level "Play" starts. Only on the menu, and only among unlocked levels. */
  select(levelIndex: number): void {
    this.assertPlayable(levelIndex);
    if (this.current !== 'menu' || levelIndex === this.currentLevelIndex) return;
    this.currentLevelIndex = levelIndex;
    this.go('menu');
  }

  /**
   * Opens the briefing of a level: the round exists but is frozen, so the player can see which
   * crabs are coming before `start()` lets it run.
   */
  play(levelIndex: number = this.currentLevelIndex): void {
    this.begin(levelIndex, 'briefing');
  }

  /** Ends the briefing and lets the round run. */
  start(): void {
    if (this.current !== 'briefing') return;
    this.currentSession?.resume();
    this.go('playing');
  }

  /** Plays the same level again straight away (no briefing: the player has just seen it). */
  retry(): void {
    this.begin(this.currentLevelIndex, 'playing');
  }

  pause(): void {
    if (this.current !== 'playing') return;
    this.currentSession?.pause();
    this.go('paused');
  }

  resume(): void {
    if (this.current !== 'paused') return;
    this.currentSession?.resume();
    this.go('playing');
  }

  togglePause(): void {
    if (this.current === 'playing') this.pause();
    else if (this.current === 'paused') this.resume();
  }

  /** After the end screen of a won level, goes on to the level that comes next. */
  next(): void {
    const target = this.currentOutcome?.nextLevelIndex;
    if (this.current !== 'ended' || target === undefined) return;
    this.play(target);
  }

  toMenu(): void {
    // After a win the menu offers the level that was just opened.
    const advanced = this.currentOutcome?.nextLevelIndex;
    if (advanced !== undefined) this.currentLevelIndex = advanced;
    this.currentSession = undefined;
    this.currentOutcome = undefined;
    this.go('menu');
  }

  private begin(levelIndex: number, screen: 'briefing' | 'playing'): void {
    this.assertPlayable(levelIndex);
    const level = this.deps.levels[levelIndex];
    if (level === undefined) return; // unreachable: assertPlayable checked the range
    this.currentLevelIndex = levelIndex;
    this.currentOutcome = undefined;
    const session = new GameSession(
      { level, crabSpecs: this.deps.crabSpecs },
      this.deps.newSeed(),
      this.deps.bus,
    );
    if (screen === 'briefing') session.pause();
    this.currentSession = session;
    for (const listener of this.roundStartListeners) listener();
    this.go(screen);
  }

  private onEvent(event: DomainEvent): void {
    if (this.current !== 'playing') return;
    if (event.type === 'LevelCleared') this.finish('won');
    else if (event.type === 'RoundLost') this.finish('lost');
  }

  private finish(result: RoundOutcome['result']): void {
    const state = this.currentSession?.state;
    if (state === undefined) return;
    const level = this.deps.levels[this.currentLevelIndex];
    const previousBest = level === undefined ? 0 : (this.bestScores[level.id] ?? 0);
    if (level !== undefined && state.score > previousBest) {
      this.bestScores = { ...this.bestScores, [level.id]: state.score };
    }
    const hasNext = this.currentLevelIndex + 1 < this.deps.levels.length;
    if (result === 'won' && hasNext) {
      this.frontierIndex = Math.max(this.frontierIndex, this.currentLevelIndex + 1);
    }
    this.currentOutcome = {
      result,
      levelIndex: this.currentLevelIndex,
      score: state.score,
      hits: state.hits,
      throws: state.throws,
      ammoLeft: state.ammo,
      bestScore: Math.max(previousBest, state.score),
      newBest: previousBest > 0 && state.score > previousBest,
      nextLevelIndex: result === 'won' && hasNext ? this.currentLevelIndex + 1 : undefined,
      campaignComplete: result === 'won' && !hasNext,
    };
    const outcome = this.currentOutcome;
    for (const listener of this.roundEndListeners) listener(outcome);
    this.go('ended');
  }

  private assertPlayable(levelIndex: number): void {
    if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= this.deps.levels.length) {
      throw new RangeError(`Unknown level index ${levelIndex}`);
    }
    if (levelIndex > this.frontierIndex) {
      throw new RangeError(`Level index ${levelIndex} is still locked`);
    }
  }

  private openSettings(screen: 'audio' | 'language'): void {
    if (this.current === 'menu' || this.current === 'paused') this.origin = this.current;
    else if (this.current !== 'audio' && this.current !== 'language') return;
    this.go(screen);
  }

  private go(screen: Screen): void {
    this.current = screen;
    for (const listener of this.listeners) listener();
  }
}
