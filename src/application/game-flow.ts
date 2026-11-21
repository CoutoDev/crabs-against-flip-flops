import type { CrabSpecs } from '../domain/entities/crab';
import type { LevelConfig } from '../domain/entities/level';
import type { DomainEvent } from '../domain/events';
import type { EventBus } from './event-bus';
import { GameSession } from './game-session';

export type Screen = 'menu' | 'playing' | 'paused' | 'ended';

export interface RoundOutcome {
  readonly result: 'won' | 'lost';
  readonly levelIndex: number;
  readonly score: number;
  readonly hits: number;
  readonly throws: number;
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
  private currentSession: GameSession | undefined;
  private currentOutcome: RoundOutcome | undefined;
  private currentLevelIndex = 0;
  private frontierIndex = 0;
  private bestScores: Readonly<Record<number, number>> = {};
  private listeners: readonly (() => void)[] = [];

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

  /** Chooses which level "Play" starts. Only on the menu, and only among unlocked levels. */
  select(levelIndex: number): void {
    this.assertPlayable(levelIndex);
    if (this.current !== 'menu' || levelIndex === this.currentLevelIndex) return;
    this.currentLevelIndex = levelIndex;
    this.go('menu');
  }

  /** Starts a fresh round of the given level (also used to retry or play again). */
  play(levelIndex: number = this.currentLevelIndex): void {
    this.assertPlayable(levelIndex);
    const level = this.deps.levels[levelIndex];
    if (level === undefined) return; // unreachable: assertPlayable checked the range
    this.currentLevelIndex = levelIndex;
    this.currentOutcome = undefined;
    this.currentSession = new GameSession(
      { level, crabSpecs: this.deps.crabSpecs },
      this.deps.newSeed(),
      this.deps.bus,
    );
    this.go('playing');
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

  private onEvent(event: DomainEvent): void {
    if (this.current !== 'playing') return;
    if (event.type === 'LevelCleared') this.finish('won');
    else if (event.type === 'RoundLost') this.finish('lost');
  }

  private finish(result: RoundOutcome['result']): void {
    const state = this.currentSession?.state;
    if (state === undefined) return;
    const level = this.deps.levels[this.currentLevelIndex];
    if (level !== undefined && state.score > (this.bestScores[level.id] ?? 0)) {
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
      nextLevelIndex: result === 'won' && hasNext ? this.currentLevelIndex + 1 : undefined,
      campaignComplete: result === 'won' && !hasNext,
    };
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

  private go(screen: Screen): void {
    this.current = screen;
    for (const listener of this.listeners) listener();
  }
}
