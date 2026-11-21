import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../../domain/events';
import { Effects, FLOATER_TTL_MS, PUFF_TTL_MS } from './effects';
import { COLOR } from './palette';

const hit = (overrides: Partial<Extract<DomainEvent, { type: 'CrabHit' }>> = {}): DomainEvent => ({
  type: 'CrabHit',
  crabId: 1,
  crabType: 'common',
  position: { x: 100, y: 90 },
  basePoints: 10,
  multiplier: 1,
  points: 10,
  combo: 1,
  score: 10,
  ...overrides,
});

describe('Effects', () => {
  it('shows a white score pop above a plain hit', () => {
    const effects = new Effects();
    effects.handle(hit());
    expect(effects.floaters).toEqual([
      { text: '+10', x: 100, y: 80, color: COLOR.white, ttlMs: FLOATER_TTL_MS, ageMs: 0 },
    ]);
  });

  it('shows the multiplier, in yellow, when the combo is active', () => {
    const effects = new Effects();
    effects.handle(hit({ multiplier: 2, points: 20 }));
    expect(effects.floaters[0]).toMatchObject({ text: '+20 x2', color: COLOR.sun });
  });

  it('puffs dust where a flip flop missed', () => {
    const effects = new Effects();
    effects.handle({
      type: 'SlipperMissed',
      flightId: 1,
      position: { x: 50, y: 60 },
      lostCombo: 0,
    });
    expect(effects.puffs).toEqual([{ x: 50, y: 60, ttlMs: PUFF_TTL_MS, ageMs: 0 }]);
  });

  it('celebrates a milestone at the top center', () => {
    const effects = new Effects();
    effects.handle({ type: 'ScoreMilestone', milestone: 50, score: 60 });
    expect(effects.floaters[0]).toMatchObject({ text: '50', x: 160, color: COLOR.sun });
  });

  it('ignores events that have no visual effect', () => {
    const effects = new Effects();
    effects.handle({ type: 'RoundLost', score: 0 });
    effects.handle({ type: 'ThrowRejected', reason: 'no_ammo' });
    expect(effects.floaters).toHaveLength(0);
    expect(effects.puffs).toHaveLength(0);
  });

  it('ages effects with real time and removes the expired ones', () => {
    const effects = new Effects();
    effects.handle(hit());
    effects.handle({ type: 'SlipperMissed', flightId: 1, position: { x: 1, y: 1 }, lostCombo: 0 });
    effects.update(PUFF_TTL_MS + 1);
    expect(effects.puffs).toHaveLength(0);
    expect(effects.floaters).toHaveLength(1);
    expect(effects.floaters[0]?.ageMs).toBe(PUFF_TTL_MS + 1);
    effects.update(FLOATER_TTL_MS);
    expect(effects.floaters).toHaveLength(0);
  });

  it('clears everything', () => {
    const effects = new Effects();
    effects.handle(hit());
    effects.clear();
    expect(effects.floaters).toHaveLength(0);
  });
});
