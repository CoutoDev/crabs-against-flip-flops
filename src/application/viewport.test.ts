import { describe, expect, it } from 'vitest';
import { clientToField, computeIntegerScale } from './viewport';

describe('computeIntegerScale', () => {
  it('picks the largest whole zoom that fits both dimensions', () => {
    expect(computeIntegerScale(1920, 1080)).toBe(6); // 320*6 = 1920, 180*6 = 1080
    expect(computeIntegerScale(1919, 1080)).toBe(5);
    expect(computeIntegerScale(1920, 1079)).toBe(5);
  });

  it('is limited by the tighter dimension', () => {
    expect(computeIntegerScale(2000, 400)).toBe(2);
    expect(computeIntegerScale(700, 2000)).toBe(2);
  });

  it('never goes below 1, even on tiny screens', () => {
    expect(computeIntegerScale(100, 50)).toBe(1);
    expect(computeIntegerScale(0, 0)).toBe(1);
  });
});

describe('clientToField', () => {
  const rect = { left: 100, top: 50, width: 640, height: 360 }; // 2x zoom

  it('maps corners and the center', () => {
    expect(clientToField(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(clientToField(740, 410, rect)).toEqual({ x: 320, y: 180 });
    expect(clientToField(420, 230, rect)).toEqual({ x: 160, y: 90 });
  });

  it('keeps fractional field positions (no rounding)', () => {
    expect(clientToField(101, 51, rect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('returns undefined for an element without size', () => {
    expect(clientToField(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toBeUndefined();
  });
});
