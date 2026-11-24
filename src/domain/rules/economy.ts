/** What the player holds: points waiting in the bank, and coins to spend in the shop. */
export interface Wallet {
  readonly points: number;
  readonly coins: number;
}

export type ConvertFailure = 'not-enough-points' | 'less-than-one-coin';

export type ConvertResult =
  | { readonly ok: true; readonly wallet: Wallet; readonly converted: number }
  | { readonly ok: false; readonly reason: ConvertFailure };

/**
 * Pure: trades up to `points` of the bank for coins. The amount is rounded down to whole coins and
 * the rest stays in the bank. `converted` is how many coins were added.
 */
export function convertPoints(
  wallet: Wallet,
  points: number,
  pointsPerCoin: number,
): ConvertResult {
  if (!Number.isInteger(points) || points < 0) return { ok: false, reason: 'less-than-one-coin' };
  if (points > wallet.points) return { ok: false, reason: 'not-enough-points' };
  const converted = Math.floor(points / pointsPerCoin);
  if (converted < 1) return { ok: false, reason: 'less-than-one-coin' };
  return {
    ok: true,
    converted,
    wallet: { points: wallet.points - converted * pointsPerCoin, coins: wallet.coins + converted },
  };
}

/** How many coins the whole bank is worth (what "Convert all" would add). */
export const coinsFor = (points: number, pointsPerCoin: number): number =>
  Math.floor(Math.max(0, points) / pointsPerCoin);

export interface BankCredit {
  /** Points that go to the bank. */
  readonly points: number;
  /** True when the replay rule cut the round's points, so the dialog can say why. */
  readonly reduced: boolean;
}

/**
 * Pure: how many of a round's points reach the bank (anti-farm). The first time a level is played
 * the points count in full, even after a loss; once the level was cleared, every round on it
 * credits `replayPercent` of its points, rounded down.
 */
export function bankCredit(
  score: number,
  levelAlreadyCleared: boolean,
  replayPercent: number,
): BankCredit {
  const whole = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  if (!levelAlreadyCleared) return { points: whole, reduced: false };
  const points = Math.floor((whole * replayPercent) / 100);
  return { points, reduced: points < whole };
}
