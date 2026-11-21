import { describe, expect, it } from 'vitest';
import { clientToField, computeIntegerScale } from './viewport';

describe('computeIntegerScale', () => {
  it('picks the largest whole zoom that fits both dimensions', () => {
    expect(computeIntegerScale(1080, 1920)).toBe(6); // 180*6 = 1080, 320*6 = 1920
    expect(computeIntegerScale(1079, 1920)).toBe(5);
    expect(computeIntegerScale(1080, 1919)).toBe(5);
  });

  it('is limited by the tighter dimension (usually the height: the field is portrait)', () => {
    expect(computeIntegerScale(2000, 700)).toBe(2); // 700 / 320 = 2.18
    expect(computeIntegerScale(400, 2000)).toBe(2); // 400 / 180 = 2.22
  });

  it('never goes below one device pixel per field pixel, even on tiny screens', () => {
    expect(computeIntegerScale(100, 50)).toBe(1);
    expect(computeIntegerScale(0, 0)).toBe(1);
    expect(computeIntegerScale(100, 50, 3)).toBeCloseTo(1 / 3, 10);
  });

  it('counts whole DEVICE pixels, so phones get finer, still crisp, steps', () => {
    // 390x560 CSS px at 3x = 1170x1680 device px → 5 device px per field pixel = 1.667 CSS px.
    const scale = computeIntegerScale(390, 560, 3);
    expect(scale).toBeCloseTo(5 / 3, 10);
    expect(scale * 3).toBe(5); // an exact whole number of device pixels
    // The same box on a regular screen could only use 1x.
    expect(computeIntegerScale(390, 560, 1)).toBe(1);
  });

  it('fits a typical phone with its browser bars and the HUD in portrait', () => {
    const scale = computeIntegerScale(390, 640, 3); // 640 / 320 = 2.0 → exactly 2x
    expect(scale).toBe(2);
    expect(180 * scale).toBeLessThanOrEqual(390);
    expect(320 * scale).toBeLessThanOrEqual(640);
  });

  it('treats a missing or invalid ratio as 1', () => {
    expect(computeIntegerScale(1080, 1920, 0)).toBe(6);
    expect(computeIntegerScale(1080, 1920, Number.NaN)).toBe(6);
    expect(computeIntegerScale(1080, 1920, 0.5)).toBe(6);
  });
});

describe('clientToField', () => {
  const rect = { left: 100, top: 50, width: 360, height: 640 }; // 2x zoom

  it('maps corners and the center', () => {
    expect(clientToField(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(clientToField(460, 690, rect)).toEqual({ x: 180, y: 320 });
    expect(clientToField(280, 370, rect)).toEqual({ x: 90, y: 160 });
  });

  it('keeps fractional field positions (no rounding)', () => {
    expect(clientToField(101, 51, rect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('returns undefined for an element without size', () => {
    expect(clientToField(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toBeUndefined();
  });
});
