import { describe, expect, it } from 'vitest';
import { COLOR, contrastRatio, hexToRgb, PALETTE_HEX, PALETTE_RGB } from './palette';

describe('palette', () => {
  it('has exactly 16 distinct valid colors', () => {
    expect(PALETTE_HEX).toHaveLength(16);
    expect(new Set(PALETTE_HEX).size).toBe(16);
    for (const hex of PALETTE_HEX) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('names every index exactly once', () => {
    expect(Object.values(COLOR).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
  });

  it('converts hex to rgb', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
    expect(PALETTE_RGB[COLOR.white]).toEqual([255, 255, 255]);
    expect(() => hexToRgb('red')).toThrow(RangeError);
  });
});

describe('palette contrast (WCAG)', () => {
  it('computes the known extremes', () => {
    expect(contrastRatio(COLOR.white, COLOR.white)).toBeCloseTo(1, 5);
    expect(contrastRatio(COLOR.white, COLOR.ink)).toBeGreaterThan(14);
  });

  it('keeps text readable: AAA (>= 7) for white and light sand on ink', () => {
    expect(contrastRatio(COLOR.white, COLOR.ink)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(COLOR.lightSand, COLOR.ink)).toBeGreaterThanOrEqual(7);
  });

  it('keeps accents usable on ink: AA (>= 4.5) for coral and sun', () => {
    expect(contrastRatio(COLOR.coral, COLOR.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(COLOR.sun, COLOR.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps sprite outlines (ink) distinguishable from every ground and sky tone (WCAG 1.4.11, 3:1)', () => {
    // Sprites are outlined in ink, so the outline, not the fill, carries the shape. The sole's own
    // color (coral) is NOT enough against dark sand (1.02:1), which is why the outline matters.
    for (const ground of [COLOR.lightSand, COLOR.sand, COLOR.darkSand, COLOR.sea, COLOR.sky]) {
      expect(contrastRatio(COLOR.ink, ground)).toBeGreaterThanOrEqual(3);
    }
  });

  it('rejects unknown indices', () => {
    expect(() => contrastRatio(0, 99)).toThrow(RangeError);
  });
});
