import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../../domain/events';
import { createRng } from '../../domain/rng';
import {
  CONFETTI_PIECES,
  CONFETTI_TTL_MS,
  Effects,
  FLOATER_TTL_MS,
  HIT_PARTICLES,
  HIT_PARTICLES_REDUCED,
  MAX_PARTICLES,
  PARTICLE_TTL_MS,
  PUFF_TTL_MS,
  SHAKE_MS,
} from './effects';
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
    expect(effects.floaters[0]).toMatchObject({ text: '50', x: 90, color: COLOR.sun });
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

describe('Effects: particles, shake and confetti', () => {
  const effectsWith = (reduced = false) =>
    new Effects({ rng: createRng(7), reducedMotion: () => reduced });
  const cleared: DomainEvent = { type: 'LevelCleared', score: 100, ammoLeft: 2 };

  it('bursts into bits of the crab own colors where it was hit', () => {
    const effects = effectsWith();
    effects.handle(hit({ crabType: 'swimmer' }));
    expect(effects.particles).toHaveLength(HIT_PARTICLES);
    const colors = new Set(effects.particles.map((p) => p.color));
    expect(colors).toEqual(new Set([COLOR.sea, COLOR.sky]));
    for (const p of effects.particles) expect([p.x, p.y]).toEqual([100, 90]);
  });

  it('flies, falls with gravity and disappears', () => {
    const effects = effectsWith();
    effects.handle(hit());
    const before = effects.particles[0];
    effects.update(100);
    const after = effects.particles[0];
    expect(after?.vy).toBeGreaterThan(before?.vy ?? 0); // gravity pulls down
    expect(after?.x).not.toBe(before?.x);
    effects.update(PARTICLE_TTL_MS);
    expect(effects.particles).toHaveLength(0);
  });

  it('is repeatable: the same seed gives the same burst', () => {
    const a = effectsWith();
    const b = effectsWith();
    a.handle(hit());
    b.handle(hit());
    expect(a.particles).toEqual(b.particles);
  });

  it('shakes a little on a hit and settles back to still', () => {
    const effects = effectsWith();
    expect(effects.shake).toEqual({ x: 0, y: 0 });
    effects.handle(hit({ multiplier: 3 }));
    let moved = false;
    for (let i = 0; i < 4; i += 1) {
      effects.update(16);
      if (effects.shake.x !== 0 || effects.shake.y !== 0) moved = true;
    }
    expect(moved).toBe(true);
    effects.update(SHAKE_MS * 2);
    expect(effects.shake).toEqual({ x: 0, y: 0 });
  });

  it('never shakes farther than three pixels', () => {
    const effects = effectsWith();
    effects.handle(hit({ multiplier: 4 }));
    for (let i = 0; i < 20; i += 1) {
      effects.update(5);
      expect(Math.abs(effects.shake.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(effects.shake.y)).toBeLessThanOrEqual(3);
    }
  });

  it('throws confetti when the level is cleared', () => {
    const effects = effectsWith();
    effects.handle(cleared);
    expect(effects.particles).toHaveLength(CONFETTI_PIECES);
    effects.update(CONFETTI_TTL_MS);
    expect(effects.particles).toHaveLength(0);
  });

  it('keeps the number of particles bounded', () => {
    const effects = effectsWith();
    for (let i = 0; i < 40; i += 1) effects.handle(hit());
    expect(effects.particles.length).toBeLessThanOrEqual(MAX_PARTICLES);
  });

  describe('when the player asked for less motion', () => {
    it('does not shake', () => {
      const effects = effectsWith(true);
      effects.handle(hit({ multiplier: 4 }));
      effects.handle({ type: 'ScoreMilestone', milestone: 100, score: 100 });
      for (let i = 0; i < 10; i += 1) {
        effects.update(16);
        expect(effects.shake).toEqual({ x: 0, y: 0 });
      }
    });

    it('bursts into just a few bits and throws no confetti', () => {
      const effects = effectsWith(true);
      effects.handle(hit());
      expect(effects.particles).toHaveLength(HIT_PARTICLES_REDUCED);
      effects.clear();
      effects.handle(cleared);
      expect(effects.particles).toHaveLength(0);
    });

    it('still shows the score pop: information is not motion', () => {
      const effects = effectsWith(true);
      effects.handle(hit());
      expect(effects.floaters).toHaveLength(1);
    });

    it('follows the setting live, not only at creation', () => {
      let reduced = false;
      const effects = new Effects({ rng: createRng(1), reducedMotion: () => reduced });
      reduced = true;
      effects.handle(hit());
      expect(effects.particles).toHaveLength(HIT_PARTICLES_REDUCED);
    });
  });

  it('clear() removes everything, including a shake in progress', () => {
    const effects = effectsWith();
    effects.handle(hit());
    effects.handle(cleared);
    effects.clear();
    expect(effects.particles).toHaveLength(0);
    effects.update(16);
    expect(effects.shake).toEqual({ x: 0, y: 0 });
  });
});
