import { describe, expect, it } from 'vitest';
import { clamp, distance, lerp } from './geometry';

describe('geometry', () => {
  it('computes the euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('distance is symmetric', () => {
    const a = { x: 10, y: -4 };
    const b = { x: -2, y: 7 };
    expect(distance(a, b)).toBe(distance(b, a));
  });

  it('lerps between two values', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('clamps into a range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
