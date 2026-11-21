import type { DomainEvent } from '../../domain/events';
import type { SfxId } from './sfx-specs';

export interface SfxRequest {
  readonly id: SfxId;
  /** Semitones to raise the pitch by (used for the combo "ladder"). */
  readonly semitones: number;
}

/** Pentatonic ladder: each consecutive hit sounds higher, and it always stays in tune. */
export const COMBO_LADDER_SEMITONES = [0, 2, 4, 7, 9, 12] as const;

export function comboSemitones(combo: number): number {
  const index = Math.min(Math.max(combo, 1), COMBO_LADDER_SEMITONES.length) - 1;
  return COMBO_LADDER_SEMITONES[index] ?? 0;
}

const plain = (id: SfxId): SfxRequest => ({ id, semitones: 0 });

/** Which sound, if any, a domain event should make. Pure, so the rules are unit tested. */
export function sfxForEvent(event: DomainEvent): SfxRequest | undefined {
  switch (event.type) {
    case 'SlipperThrown':
      return plain('throw');
    case 'CrabHit':
      return { id: 'hit', semitones: comboSemitones(event.combo) };
    case 'SlipperMissed':
      return plain('miss');
    case 'ScoreMilestone':
      return plain('milestone');
    case 'LevelCleared':
      return plain('win');
    case 'RoundLost':
      return plain('lose');
    // "round_over" is not feedback worth a sound: the end screen is already showing.
    case 'ThrowRejected':
      return event.reason === 'no_ammo' ? plain('rejected') : undefined;
  }
}
