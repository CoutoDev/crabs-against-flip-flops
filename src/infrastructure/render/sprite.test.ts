import { describe, expect, it } from 'vitest';
import { flipX, parseSprite, recolor, rotate90, SLOT_BASE, symmetric, TRANSPARENT } from './sprite';

const at = (sprite: ReturnType<typeof parseSprite>, x: number, y: number) =>
  sprite.pixels[y * sprite.width + x];

describe('parseSprite', () => {
  it('reads transparent, palette and slot characters', () => {
    const sprite = parseSprite('t', ['.0f', 'ST.']);
    expect(sprite.width).toBe(3);
    expect(sprite.height).toBe(2);
    expect([...sprite.pixels]).toEqual([TRANSPARENT, 0, 15, SLOT_BASE, SLOT_BASE + 1, TRANSPARENT]);
  });

  it('rejects empty sprites, ragged rows and unknown characters, naming the sprite', () => {
    expect(() => parseSprite('empty', [])).toThrow(/empty/);
    expect(() => parseSprite('ragged', ['00', '0'])).toThrow(/ragged.*row 1/);
    expect(() => parseSprite('bad', ['0z'])).toThrow(/bad.*"z".*row 0, column 1/);
  });
});

describe('sprite transforms', () => {
  const sprite = parseSprite('t', ['12.', '.34']);

  it('mirrors a half into a symmetric sprite', () => {
    const full = symmetric('s', ['1.', '23']);
    expect(full.width).toBe(4);
    expect([...full.pixels]).toEqual([1, TRANSPARENT, TRANSPARENT, 1, 2, 3, 3, 2]);
  });

  it('flips horizontally without touching the original', () => {
    const flipped = flipX(sprite);
    expect([...flipped.pixels]).toEqual([TRANSPARENT, 2, 1, 4, 3, TRANSPARENT]);
    expect(at(sprite, 0, 0)).toBe(1);
  });

  it('rotates 90 degrees clockwise (and four times gives the original)', () => {
    const rotated = rotate90(sprite);
    expect(rotated.width).toBe(2);
    expect(rotated.height).toBe(3);
    // 12.      .1
    // .34  →   32
    //          4.
    expect([...rotated.pixels]).toEqual([TRANSPARENT, 1, 3, 2, 4, TRANSPARENT]);
    expect([...rotate90(rotate90(rotate90(rotate90(sprite)))).pixels]).toEqual([...sprite.pixels]);
  });

  it('recolors only the mapped indices', () => {
    const recolored = recolor(sprite, { 1: 9, 3: 8 });
    expect([...recolored.pixels]).toEqual([9, 2, TRANSPARENT, TRANSPARENT, 8, 4]);
  });
});
