import type { CrabType } from './entities/crab';
import type { Vec2 } from './geometry';

export type ThrowRejectionReason = 'no_ammo' | 'round_over';

/**
 * Facts emitted by the simulation. Adapters (audio, renderer effects, HUD) react to them; the
 * domain never produces user-facing text, only ids and numbers.
 */
export type DomainEvent =
  | {
      readonly type: 'SlipperThrown';
      readonly flightId: number;
      readonly target: Vec2;
      readonly durationMs: number;
    }
  | { readonly type: 'ThrowRejected'; readonly reason: ThrowRejectionReason }
  | {
      readonly type: 'CrabHit';
      readonly crabId: number;
      readonly crabType: CrabType;
      readonly position: Vec2;
      readonly basePoints: number;
      readonly multiplier: number;
      readonly points: number;
      readonly combo: number;
      readonly score: number;
    }
  | {
      readonly type: 'SlipperMissed';
      readonly flightId: number;
      readonly position: Vec2;
      /** Combo the player had just before this miss reset it. */
      readonly lostCombo: number;
    }
  | { readonly type: 'ScoreMilestone'; readonly milestone: number; readonly score: number }
  | { readonly type: 'LevelCleared'; readonly score: number; readonly ammoLeft: number }
  | { readonly type: 'RoundLost'; readonly score: number };
