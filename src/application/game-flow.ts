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
}

export interface GameFlowDeps {
  readonly levels: readonly LevelConfig[];
  readonly crabSpecs: CrabSpecs;
  /** Impure on purpose: the composition root provides randomness, the application layer stays pure. */
  readonly newSeed: () => number;
  readonly bus: EventBus<DomainEvent>;
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
  private listeners: readonly (() => void)[] = [];

  constructor(private readonly deps: GameFlowDeps) {
    if (deps.levels.length === 0) throw new RangeError('GameFlow needs at least one level');
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

  get levelIndex(): number {
    return this.currentLevelIndex;
  }

  /** Returns the unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  /** Starts a fresh round of the given level (also used to retry or play again). */
  play(levelIndex: number = this.currentLevelIndex): void {
    const level = this.deps.levels[levelIndex];
    if (level === undefined) throw new RangeError(`Unknown level index ${levelIndex}`);
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

  toMenu(): void {
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
    this.currentOutcome = {
      result,
      levelIndex: this.currentLevelIndex,
      score: state.score,
      hits: state.hits,
      throws: state.throws,
    };
    this.go('ended');
  }

  private go(screen: Screen): void {
    this.current = screen;
    for (const listener of this.listeners) listener();
  }
}
