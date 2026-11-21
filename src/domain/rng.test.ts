import { describe, expect, it } from 'vitest';
import { between, createRng, pickWeighted } from './rng';
import { sequenceRng } from './test-support';

const draw = (count: number, next: () => number): number[] =>
  Array.from({ length: count }, () => next());

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    expect(draw(5, () => a.next())).toEqual(draw(5, () => b.next()));
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(99);
    for (const value of draw(1000, () => rng.next())) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(draw(5, () => a.next())).not.toEqual(draw(5, () => b.next()));
  });

  it('resumes the same sequence from its exposed state', () => {
    const original = createRng(7);
    original.next();
    original.next();
    const resumed = createRng(original.state);
    expect(draw(5, () => resumed.next())).toEqual(draw(5, () => original.next()));
  });

  it('normalizes seeds to 32 bits', () => {
    expect(createRng(2 ** 32 + 5).next()).toBe(createRng(5).next());
  });
});

describe('between', () => {
  it('maps a draw into [min, max)', () => {
    expect(between(sequenceRng([0]), 10, 20)).toBe(10);
    expect(between(sequenceRng([0.5]), 10, 20)).toBe(15);
  });

  it('consumes exactly one draw', () => {
    const rng = sequenceRng([0.3]);
    between(rng, 0, 1);
    expect(rng.state).toBe(1);
  });
});

describe('pickWeighted', () => {
  const items = [
    { name: 'light', weight: 1 },
    { name: 'heavy', weight: 3 },
  ];
  const pick = (value: number) => pickWeighted(sequenceRng([value]), items, (i) => i.weight).name;

  it('respects the weights at the boundaries', () => {
    expect(pick(0)).toBe('light');
    expect(pick(0.24)).toBe('light');
    expect(pick(0.25)).toBe('heavy');
    expect(pick(0.999)).toBe('heavy');
  });

  it('consumes exactly one draw', () => {
    const rng = sequenceRng([0.5]);
    pickWeighted(rng, items, (i) => i.weight);
    expect(rng.state).toBe(1);
  });

  it('throws on an empty list', () => {
    expect(() => pickWeighted(sequenceRng([0.5]), [], () => 1)).toThrow(RangeError);
  });
});
