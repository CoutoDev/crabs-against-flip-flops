import { describe, expect, it } from 'vitest';
import { makeCrab, TEST_CRAB_SPECS } from '../test-support';
import { findHitCrab } from './collision';

// common hit radius = 10, slipper radius = 6, so a landing within 16px of the center is a hit.
const SLIPPER_RADIUS = 6;
const find = (landingX: number, crabs = [makeCrab()]) =>
  findHitCrab({ x: landingX, y: 100 }, crabs, TEST_CRAB_SPECS, SLIPPER_RADIUS);

describe('findHitCrab', () => {
  it('hits a crab when the flip flop lands on it', () => {
    expect(find(110)?.id).toBe(100);
  });

  it('includes the exact edge of the reach', () => {
    expect(find(116)?.id).toBe(100);
  });

  it('misses just beyond the reach', () => {
    expect(find(117)).toBeUndefined();
  });

  it('returns undefined when there are no crabs', () => {
    expect(find(100, [])).toBeUndefined();
  });

  it('picks the nearest crab when several overlap', () => {
    const crabs = [makeCrab({ id: 1, x: 100 }), makeCrab({ id: 2, x: 108 })];
    expect(find(106, crabs)?.id).toBe(2);
  });

  it('breaks ties by the lowest id, regardless of array order', () => {
    const crabs = [makeCrab({ id: 5, x: 90 }), makeCrab({ id: 3, x: 110 })];
    expect(find(100, crabs)?.id).toBe(3);
  });

  it('uses the hit radius of each crab type', () => {
    const fiddler = makeCrab({ type: 'fiddler' }); // radius 6 → reach 12
    expect(find(114, [fiddler])).toBeUndefined();
    expect(find(114, [makeCrab()])?.id).toBe(100); // common (reach 16) would be hit
  });
});
