import type { Framebuffer } from './framebuffer';

/** 3×5 pixel font with just what the canvas needs: score pops ("+20 x2") and numbers. */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  x: ['...', '#.#', '.#.', '#.#', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  ' ': ['...', '...', '...', '...', '...'],
};

export const GLYPH_WIDTH = 3;
export const GLYPH_HEIGHT = 5;
const SPACING = 1;

export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * (GLYPH_WIDTH + SPACING) - SPACING;
}

function drawGlyphs(fb: Framebuffer, text: string, x: number, y: number, color: number): void {
  let cursor = Math.round(x);
  for (const char of text) {
    const glyph = GLYPHS[char];
    if (glyph === undefined) throw new RangeError(`Font has no glyph for "${char}"`);
    glyph.forEach((row, dy) => {
      for (let dx = 0; dx < GLYPH_WIDTH; dx += 1) {
        if (row.charAt(dx) === '#') fb.setPixel(cursor + dx, y + dy, color);
      }
    });
    cursor += GLYPH_WIDTH + SPACING;
  }
}

/** Draws text with its top-left at (x, y); `outline` adds a 1 px border for legibility. */
export function drawText(
  fb: Framebuffer,
  text: string,
  x: number,
  y: number,
  color: number,
  outline?: number,
): void {
  if (outline !== undefined) {
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      drawGlyphs(fb, text, x + ox, y + oy, outline);
    }
  }
  drawGlyphs(fb, text, x, y, color);
}
