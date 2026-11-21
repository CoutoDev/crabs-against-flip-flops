import type { CrabType } from '../../domain/entities/crab';
import type { DomainEvent } from '../../domain/events';
import { FIELD_WIDTH_PX } from '../../domain/constants';
import { between, createRng, type Rng } from '../../domain/rng';
import { COLOR } from './palette';

export interface Floater {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly ttlMs: number;
  readonly ageMs: number;
}

export interface Puff {
  readonly x: number;
  readonly y: number;
  readonly ttlMs: number;
  readonly ageMs: number;
}

/** A bit of shell, a spark or a piece of confetti: it flies, falls and fades by shrinking. */
export interface Particle {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly gravity: number;
  readonly color: number;
  /** Side of the square in field pixels: 1 to 3. */
  readonly size: number;
  readonly ttlMs: number;
  readonly ageMs: number;
}

export const HIT_PARTICLES = 12;
export const HIT_PARTICLES_REDUCED = 4;
export const CONFETTI_PIECES = 60;
export const PARTICLE_TTL_MS = 520;
export const CONFETTI_TTL_MS = 2200;
export const SHAKE_MS = 150;
export const MAX_PARTICLES = 160;

/** Colors a crab bursts into when it is hit (its body and its highlight). */
const BURST_COLORS: Readonly<Record<CrabType, readonly [number, number]>> = {
  common: [COLOR.crabRed, COLOR.coral],
  swimmer: [COLOR.sea, COLOR.sky],
  fiddler: [COLOR.sun, COLOR.coral],
};
const CONFETTI_COLORS = [
  COLOR.sun,
  COLOR.coral,
  COLOR.magenta,
  COLOR.sky,
  COLOR.lightLeaf,
  COLOR.white,
];

export interface EffectsOptions {
  /** Source of the small random variations (a seeded one makes tests exact). */
  readonly rng?: Rng;
  /** True when the player asked the system for less motion: no shake, fewer particles, no confetti. */
  readonly reducedMotion?: () => boolean;
}

export const FLOATER_TTL_MS = 700;
export const MILESTONE_TTL_MS = 900;
export const PUFF_TTL_MS = 320;

/**
 * Short-lived visual feedback (score pops, dust puffs). It reacts to domain events and ages with
 * the real frame time, so animations keep smooth even though the simulation steps at 60 Hz.
 */
export class Effects {
  private floaterList: Floater[] = [];
  private puffList: Puff[] = [];
  private particleList: Particle[] = [];
  private shakeLeftMs = 0;
  private shakeStrength = 0;
  private shakeNow = { x: 0, y: 0 };
  private readonly rng: Rng;
  private readonly reducedMotion: () => boolean;

  constructor(options: EffectsOptions = {}) {
    this.rng = options.rng ?? createRng(1);
    this.reducedMotion = options.reducedMotion ?? (() => false);
  }

  get floaters(): readonly Floater[] {
    return this.floaterList;
  }

  get puffs(): readonly Puff[] {
    return this.puffList;
  }

  /** True while anything is moving or fading: the picture has to keep being redrawn. */
  get active(): boolean {
    return (
      this.floaterList.length > 0 ||
      this.puffList.length > 0 ||
      this.particleList.length > 0 ||
      this.shakeLeftMs > 0
    );
  }

  get particles(): readonly Particle[] {
    return this.particleList;
  }

  /** How far the whole picture is nudged this frame, in field pixels. Zero when nothing shakes. */
  get shake(): { readonly x: number; readonly y: number } {
    return this.shakeNow;
  }

  handle(event: DomainEvent): void {
    switch (event.type) {
      case 'CrabHit': {
        const text =
          event.multiplier > 1 ? `+${event.points} x${event.multiplier}` : `+${event.points}`;
        this.floaterList.push({
          text,
          x: event.position.x,
          y: event.position.y - 10,
          color: event.multiplier > 1 ? COLOR.sun : COLOR.white,
          ttlMs: FLOATER_TTL_MS,
          ageMs: 0,
        });
        this.burst(event.position.x, event.position.y, event.crabType);
        this.startShake(Math.min(3, event.multiplier), SHAKE_MS);
        break;
      }
      case 'SlipperMissed':
        this.puffList.push({
          x: event.position.x,
          y: event.position.y,
          ttlMs: PUFF_TTL_MS,
          ageMs: 0,
        });
        break;
      case 'ScoreMilestone':
        this.floaterList.push({
          text: String(event.milestone),
          x: FIELD_WIDTH_PX / 2,
          y: 40,
          color: COLOR.sun,
          ttlMs: MILESTONE_TTL_MS,
          ageMs: 0,
        });
        this.startShake(2, SHAKE_MS * 1.5);
        break;
      case 'LevelCleared':
        this.confetti();
        break;
      default:
        break;
    }
  }

  private burst(x: number, y: number, type: CrabType): void {
    const count = this.reducedMotion() ? HIT_PARTICLES_REDUCED : HIT_PARTICLES;
    const [body, light] = BURST_COLORS[type];
    for (let i = 0; i < count; i += 1) {
      const angle = between(this.rng, 0, Math.PI * 2);
      const speed = between(this.rng, 50, 130);
      this.add({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // a little upwards, then gravity takes over
        gravity: 220,
        color: i % 2 === 0 ? body : light,
        size: i % 3 === 0 ? 3 : 2,
        ttlMs: PARTICLE_TTL_MS,
        ageMs: 0,
      });
    }
  }

  private confetti(): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < CONFETTI_PIECES; i += 1) {
      this.add({
        x: between(this.rng, 0, FIELD_WIDTH_PX),
        y: between(this.rng, -20, 10),
        vx: between(this.rng, -20, 20),
        vy: between(this.rng, 20, 60),
        gravity: 40,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? COLOR.white,
        size: i % 4 === 0 ? 2 : 1,
        ttlMs: CONFETTI_TTL_MS,
        ageMs: 0,
      });
    }
  }

  /** Never more than MAX_PARTICLES alive: the oldest ones go first. */
  private add(particle: Particle): void {
    this.particleList.push(particle);
    if (this.particleList.length > MAX_PARTICLES) {
      this.particleList = this.particleList.slice(-MAX_PARTICLES);
    }
  }

  private startShake(strength: number, ms: number): void {
    if (this.reducedMotion()) return;
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeLeftMs = Math.max(this.shakeLeftMs, ms);
    this.shakeTotalMs = Math.max(this.shakeTotalMs, ms);
  }

  private shakeTotalMs = 0;

  update(dtMs: number): void {
    this.floaterList = this.floaterList
      .map((f) => ({ ...f, ageMs: f.ageMs + dtMs }))
      .filter((f) => f.ageMs < f.ttlMs);
    this.puffList = this.puffList
      .map((p) => ({ ...p, ageMs: p.ageMs + dtMs }))
      .filter((p) => p.ageMs < p.ttlMs);
    const seconds = dtMs / 1000;
    this.particleList = this.particleList
      .map((p) => ({
        ...p,
        x: p.x + p.vx * seconds,
        y: p.y + p.vy * seconds,
        vy: p.vy + p.gravity * seconds,
        ageMs: p.ageMs + dtMs,
      }))
      .filter((p) => p.ageMs < p.ttlMs);
    this.updateShake(dtMs);
  }

  private updateShake(dtMs: number): void {
    if (this.shakeLeftMs <= 0) {
      this.shakeNow = { x: 0, y: 0 };
      return;
    }
    this.shakeLeftMs = Math.max(0, this.shakeLeftMs - dtMs);
    if (this.shakeLeftMs === 0) {
      this.shakeStrength = 0;
      this.shakeTotalMs = 0;
      this.shakeNow = { x: 0, y: 0 };
      return;
    }
    // The nudge fades out as the shake ends.
    const amplitude = this.shakeStrength * (this.shakeLeftMs / this.shakeTotalMs);
    this.shakeNow = {
      x: Math.round(between(this.rng, -amplitude, amplitude)),
      y: Math.round(between(this.rng, -amplitude, amplitude)),
    };
  }

  clear(): void {
    this.floaterList = [];
    this.puffList = [];
    this.particleList = [];
    this.shakeLeftMs = 0;
    this.shakeTotalMs = 0;
    this.shakeStrength = 0;
    this.shakeNow = { x: 0, y: 0 };
  }
}
