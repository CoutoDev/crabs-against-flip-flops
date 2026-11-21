/** Pixel value: -1 transparent, 0..15 palette index, 16+ skin color slot (16 = first slot, ...). */
export const TRANSPARENT = -1;
export const SLOT_BASE = 16;

export interface Sprite {
  readonly width: number;
  readonly height: number;
  /** Row-major, `width * height` values. */
  readonly pixels: Int8Array;
}

const SLOT_CHARS = 'ST';

function charToPixel(char: string, name: string, row: number, col: number): number {
  if (char === '.') return TRANSPARENT;
  const hex = '0123456789abcdef'.indexOf(char);
  if (hex >= 0) return hex;
  const slot = SLOT_CHARS.indexOf(char);
  if (slot >= 0) return SLOT_BASE + slot;
  throw new RangeError(
    `Sprite "${name}": invalid character "${char}" at row ${row}, column ${col}`,
  );
}

/**
 * Builds a sprite from text rows: '.' transparent, '0'-'9'/'a'-'f' palette index,
 * 'S' / 'T' skin slots 0 / 1.
 */
export function parseSprite(name: string, rows: readonly string[]): Sprite {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new RangeError(`Sprite "${name}" is empty`);
  const pixels = new Int8Array(width * height);
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new RangeError(
        `Sprite "${name}": row ${y} has ${row.length} columns, expected ${width}`,
      );
    }
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = charToPixel(row.charAt(x), name, y, x);
    }
  });
  return { width, height, pixels };
}

/** Authors only the left half; the right half is its mirror image. */
export function symmetric(name: string, leftHalfRows: readonly string[]): Sprite {
  const rows = leftHalfRows.map((row) => row + [...row].reverse().join(''));
  return parseSprite(name, rows);
}

export function flipX(sprite: Sprite): Sprite {
  const pixels = new Int8Array(sprite.pixels.length);
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      pixels[y * sprite.width + (sprite.width - 1 - x)] =
        sprite.pixels[y * sprite.width + x] ?? TRANSPARENT;
    }
  }
  return { ...sprite, pixels };
}

/** Rotates 90° clockwise. */
export function rotate90(sprite: Sprite): Sprite {
  const { width, height } = sprite;
  const pixels = new Int8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // (x, y) → (height - 1 - y, x) in a sprite that is `height` wide and `width` tall.
      pixels[x * height + (height - 1 - y)] = sprite.pixels[y * width + x] ?? TRANSPARENT;
    }
  }
  return { width: height, height: width, pixels };
}

/** Replaces palette indices according to `map` (e.g. { 10: 2 } turns red into sea blue). */
export function recolor(sprite: Sprite, map: Readonly<Record<number, number>>): Sprite {
  const pixels = sprite.pixels.map((value) => map[value] ?? value);
  return { ...sprite, pixels };
}
