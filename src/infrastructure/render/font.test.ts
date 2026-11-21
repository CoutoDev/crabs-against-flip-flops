import { describe, expect, it } from 'vitest';
import { drawText, textWidth } from './font';
import { Framebuffer } from './framebuffer';
import { COLOR, PALETTE_RGB } from './palette';

const countColor = (fb: Framebuffer, color: number): number => {
  let count = 0;
  const target = PALETTE_RGB[color];
  for (let y = 0; y < fb.height; y += 1) {
    for (let x = 0; x < fb.width; x += 1) {
      const [r, g, b] = fb.rgbAt(x, y);
      if (target !== undefined && r === target[0] && g === target[1] && b === target[2]) count += 1;
    }
  }
  return count;
};

describe('font', () => {
  it('measures text as 3 px glyphs separated by 1 px', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('8')).toBe(3);
    expect(textWidth('+20')).toBe(11);
  });

  it('draws the exact pixels of a glyph', () => {
    const fb = new Framebuffer(10, 10);
    fb.clear(COLOR.ink);
    drawText(fb, '8', 2, 2, COLOR.white);
    expect(countColor(fb, COLOR.white)).toBe(13); // '8' has 13 lit pixels
    expect(fb.rgbAt(2, 2)).toEqual(PALETTE_RGB[COLOR.white]);
    expect(fb.rgbAt(3, 3)).toEqual(PALETTE_RGB[COLOR.ink]); // hole of the 8
  });

  it('adds an outline around the glyph without covering it', () => {
    const fb = new Framebuffer(12, 12);
    fb.clear(COLOR.sand);
    drawText(fb, '1', 4, 4, COLOR.white, COLOR.ink);
    expect(countColor(fb, COLOR.ink)).toBeGreaterThan(0);
    expect(countColor(fb, COLOR.white)).toBe(8); // '1' has 8 lit pixels
  });

  it('draws every character the game uses', () => {
    const fb = new Framebuffer(80, 10);
    expect(() => drawText(fb, '0123456789 +x/', 0, 0, COLOR.white)).not.toThrow();
  });

  it('fails loudly on a character without a glyph', () => {
    const fb = new Framebuffer(20, 10);
    expect(() => drawText(fb, 'A', 0, 0, COLOR.white)).toThrow(/no glyph for "A"/);
  });
});
