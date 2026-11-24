import { describe, expect, it } from 'vitest';
import { bankCredit, convertPoints, type Wallet } from './economy';

const wallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  points: 100,
  coins: 3,
  ...overrides,
});

describe('convertPoints', () => {
  it('trades points for coins at the rate and keeps the remainder in the bank', () => {
    expect(convertPoints(wallet({ points: 103 }), 103, 5)).toEqual({
      ok: true,
      wallet: { points: 3, coins: 3 + 20 },
      converted: 20,
    });
  });

  it('converts only part of the bank when asked to', () => {
    expect(convertPoints(wallet(), 50, 5)).toEqual({
      ok: true,
      wallet: { points: 50, coins: 13 },
      converted: 10,
    });
  });

  it('rounds the amount down to whole coins: a point left over is not spent', () => {
    const result = convertPoints(wallet(), 52, 5);
    expect(result).toEqual({ ok: true, wallet: { points: 50, coins: 13 }, converted: 10 });
  });

  it('refuses more points than the bank holds, changing nothing', () => {
    expect(convertPoints(wallet({ points: 40 }), 41, 5)).toEqual({
      ok: false,
      reason: 'not-enough-points',
    });
  });

  it('refuses an amount that does not make one coin', () => {
    expect(convertPoints(wallet(), 4, 5)).toEqual({ ok: false, reason: 'less-than-one-coin' });
    expect(convertPoints(wallet(), 0, 5)).toEqual({ ok: false, reason: 'less-than-one-coin' });
  });

  it.each([-5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses the amount %s', (amount) => {
    expect(convertPoints(wallet(), amount, 5).ok).toBe(false);
  });

  it('can convert the bank down to zero', () => {
    const result = convertPoints(wallet({ points: 25 }), 25, 5);
    expect(result.ok && result.wallet).toEqual({ points: 0, coins: 8 });
  });
});

describe('bankCredit', () => {
  it('credits every point while the level has not been cleared, win or lose', () => {
    expect(bankCredit(137, false, 50)).toEqual({ points: 137, reduced: false });
  });

  it('credits half (rounded down) once the level was cleared before', () => {
    expect(bankCredit(137, true, 50)).toEqual({ points: 68, reduced: true });
    expect(bankCredit(120, true, 50)).toEqual({ points: 60, reduced: true });
  });

  it('never credits a negative, fractional or invalid score', () => {
    expect(bankCredit(-50, false, 50).points).toBe(0);
    expect(bankCredit(10.9, false, 50).points).toBe(10);
    expect(bankCredit(Number.NaN, true, 50).points).toBe(0);
  });

  it('is not "reduced" when there was nothing to reduce', () => {
    expect(bankCredit(0, true, 50)).toEqual({ points: 0, reduced: false });
  });
});
