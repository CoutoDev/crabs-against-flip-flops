import type { DomainEvent } from '../../domain/events';
import { FIELD_WIDTH_PX } from '../../domain/constants';
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

  get floaters(): readonly Floater[] {
    return this.floaterList;
  }

  get puffs(): readonly Puff[] {
    return this.puffList;
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
          y: 24,
          color: COLOR.sun,
          ttlMs: MILESTONE_TTL_MS,
          ageMs: 0,
        });
        break;
      default:
        break;
    }
  }

  update(dtMs: number): void {
    this.floaterList = this.floaterList
      .map((f) => ({ ...f, ageMs: f.ageMs + dtMs }))
      .filter((f) => f.ageMs < f.ttlMs);
    this.puffList = this.puffList
      .map((p) => ({ ...p, ageMs: p.ageMs + dtMs }))
      .filter((p) => p.ageMs < p.ttlMs);
  }

  clear(): void {
    this.floaterList = [];
    this.puffList = [];
  }
}
