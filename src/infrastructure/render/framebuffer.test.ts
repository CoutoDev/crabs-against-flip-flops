import { describe, expect, it, vi } from 'vitest';
import { Framebuffer } from './framebuffer';
import { COLOR, PALETTE_RGB } from './palette';
import { parseSprite } from './sprite';

const rgb = (color: number) => PALETTE_RGB[color];

describe('Framebuffer', () => {
  it('clears to a palette color with full opacity', () => {
    const fb = new Framebuffer(4, 3);
    fb.clear(COLOR.sea);
    expect(fb.rgbAt(0, 0)).toEqual(rgb(COLOR.sea));
    expect(fb.rgbAt(3, 2)).toEqual(rgb(COLOR.sea));
    expect(fb.data[3]).toBe(255);
  });

  it('ignores pixels outside the frame instead of throwing', () => {
    const fb = new Framebuffer(4, 3);
    fb.clear(COLOR.ink);
    expect(() => fb.setPixel(-1, 0, COLOR.white)).not.toThrow();
    expect(() => fb.setPixel(4, 0, COLOR.white)).not.toThrow();
    expect(() => fb.setPixel(0, 3, COLOR.white)).not.toThrow();
    expect(fb.rgbAt(0, 0)).toEqual(rgb(COLOR.ink));
  });

  it('rejects unknown palette indices', () => {
    expect(() => new Framebuffer(2, 2).setPixel(0, 0, 99)).toThrow(RangeError);
  });

  it('fills rectangles and clips them at the edges', () => {
    const fb = new Framebuffer(4, 4);
    fb.clear(COLOR.ink);
    fb.fillRect(2, 2, 10, 10, COLOR.white);
    expect(fb.rgbAt(1, 1)).toEqual(rgb(COLOR.ink));
    expect(fb.rgbAt(2, 2)).toEqual(rgb(COLOR.white));
    expect(fb.rgbAt(3, 3)).toEqual(rgb(COLOR.white));
  });

  it('draws a filled circle', () => {
    const fb = new Framebuffer(9, 9);
    fb.clear(COLOR.ink);
    fb.fillCircle(4, 4, 3, COLOR.sun);
    expect(fb.rgbAt(4, 4)).toEqual(rgb(COLOR.sun));
    expect(fb.rgbAt(4, 1)).toEqual(rgb(COLOR.sun));
    expect(fb.rgbAt(1, 1)).toEqual(rgb(COLOR.ink));
  });

  it('rounds fractional positions to whole pixels', () => {
    const fb = new Framebuffer(4, 4);
    fb.clear(COLOR.ink);
    fb.setPixel(1.4, 1.6, COLOR.white);
    expect(fb.rgbAt(1, 2)).toEqual(rgb(COLOR.white));
  });
});

describe('Framebuffer.blit', () => {
  const sprite = parseSprite('t', ['1.2', 'S.T']);

  it('skips transparent pixels and draws the rest at the given position', () => {
    const fb = new Framebuffer(6, 4);
    fb.clear(COLOR.ink);
    fb.blit(sprite, 2, 1, { slots: [COLOR.coral, COLOR.white] });
    expect(fb.rgbAt(2, 1)).toEqual(rgb(1));
    expect(fb.rgbAt(3, 1)).toEqual(rgb(COLOR.ink)); // transparent
    expect(fb.rgbAt(4, 1)).toEqual(rgb(2));
    expect(fb.rgbAt(2, 2)).toEqual(rgb(COLOR.coral)); // slot 0
    expect(fb.rgbAt(4, 2)).toEqual(rgb(COLOR.white)); // slot 1
  });

  it('flips horizontally on request', () => {
    const fb = new Framebuffer(6, 4);
    fb.clear(COLOR.ink);
    fb.blit(sprite, 0, 0, { flipX: true, slots: [COLOR.coral, COLOR.white] });
    expect(fb.rgbAt(0, 0)).toEqual(rgb(2));
    expect(fb.rgbAt(2, 0)).toEqual(rgb(1));
  });

  it('clips sprites that are partly off screen', () => {
    const fb = new Framebuffer(4, 4);
    fb.clear(COLOR.ink);
    expect(() => fb.blit(sprite, -2, -1, { slots: [0, 0] })).not.toThrow();
    expect(() => fb.blit(sprite, 3, 3, { slots: [0, 0] })).not.toThrow();
  });

  it('fails loudly when a slot color is missing', () => {
    const fb = new Framebuffer(6, 4);
    expect(() => fb.blit(sprite, 0, 0)).toThrow(/skin slot 0/);
  });

  it('copies a whole frame', () => {
    const a = new Framebuffer(3, 3);
    const b = new Framebuffer(3, 3);
    a.clear(COLOR.leaf);
    b.copyFrom(a);
    expect(b.rgbAt(2, 2)).toEqual(rgb(COLOR.leaf));
  });

  describe('shiftBy', () => {
    const striped = () => {
      const fb = new Framebuffer(4, 3);
      for (let x = 0; x < 4; x += 1) fb.fillRect(x, 0, 1, 3, x); // column x has palette color x
      return fb;
    };

    it('moves the picture by whole pixels', () => {
      const fb = striped();
      fb.shiftBy(1, 0);
      expect(fb.rgbAt(1, 1)).toEqual(PALETTE_RGB[0]);
      expect(fb.rgbAt(3, 1)).toEqual(PALETTE_RGB[2]);
    });

    it('repeats the edge instead of leaving a hole', () => {
      const fb = striped();
      fb.shiftBy(2, 0);
      expect(fb.rgbAt(0, 1)).toEqual(PALETTE_RGB[0]);
      for (let i = 3; i < fb.data.length; i += 4) expect(fb.data[i]).toBe(255);
    });

    it('gives exactly the same picture as "read each pixel from its clamped source"', () => {
      const width = 7;
      const height = 5;
      const make = () => {
        const fb = new Framebuffer(width, height);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) fb.setPixel(x, y, (x * 3 + y * 5) % 16);
        }
        return fb;
      };
      const reference = (dx: number, dy: number) => {
        const source = make();
        const out = new Framebuffer(width, height);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const sx = Math.min(width - 1, Math.max(0, x - dx));
            const sy = Math.min(height - 1, Math.max(0, y - dy));
            const [r, g, b] = source.rgbAt(sx, sy);
            const at = (y * width + x) * 4;
            out.data.set([r, g, b, 255], at);
          }
        }
        return out;
      };
      for (let dy = -7; dy <= 7; dy += 1) {
        for (let dx = -9; dx <= 9; dx += 1) {
          const fb = make();
          fb.shiftBy(dx, dy);
          expect(fb.data, `shift (${dx}, ${dy})`).toEqual(reference(dx, dy).data);
        }
      }
    });

    it('does not allocate a copy of the frame (it runs on every shaken frame)', () => {
      const fb = new Framebuffer(8, 8);
      const slice = vi.spyOn(fb.data, 'slice');
      fb.shiftBy(2, -3);
      expect(slice).not.toHaveBeenCalled();
    });

    it('moves vertically too, and does nothing for a zero shift', () => {
      const fb = new Framebuffer(2, 3);
      fb.fillRect(0, 0, 2, 1, 5);
      fb.fillRect(0, 1, 2, 2, 6);
      const before = fb.data.slice();
      fb.shiftBy(0, 0);
      expect(fb.data).toEqual(before);
      fb.shiftBy(0, 1);
      expect(fb.rgbAt(0, 1)).toEqual(PALETTE_RGB[5]);
    });
  });
});
