/**
 * The game's 16-color palette (original, themed on beach and mangrove). Sprites store indices
 * into this table, so a skin is just a different index in a "color slot".
 */
export const PALETTE_HEX = [
  '#14213d', // 0  ink: outlines and text borders
  '#0b4f6c', // 1  deep sea
  '#1d8fa8', // 2  sea
  '#8fd3f4', // 3  sky
  '#f6e7b4', // 4  light sand
  '#e3c27a', // 5  sand
  '#b98a4b', // 6  dark sand
  '#5a3d2b', // 7  mud / mangrove root
  '#2f6b3a', // 8  leaf
  '#86b84d', // 9  light leaf
  '#c1352b', // 10 crab red
  '#f26a3d', // 11 coral
  '#ffd23f', // 12 sun
  '#ffffff', // 13 white
  '#8a8fa3', // 14 stone gray
  '#d94f9a', // 15 magenta
] as const;

export const COLOR = {
  ink: 0,
  deepSea: 1,
  sea: 2,
  sky: 3,
  lightSand: 4,
  sand: 5,
  darkSand: 6,
  mud: 7,
  leaf: 8,
  lightLeaf: 9,
  crabRed: 10,
  coral: 11,
  sun: 12,
  white: 13,
  gray: 14,
  magenta: 15,
} as const;

export type Rgb = readonly [red: number, green: number, blue: number];

export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new RangeError(`Invalid hex color: ${hex}`);
  return [
    parseInt(match[1] ?? '0', 16),
    parseInt(match[2] ?? '0', 16),
    parseInt(match[3] ?? '0', 16),
  ];
}

export const PALETTE_RGB: readonly Rgb[] = PALETTE_HEX.map(hexToRgb);

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two palette indices (1 to 21). */
export function contrastRatio(a: number, b: number): number {
  const rgbA = PALETTE_RGB[a];
  const rgbB = PALETTE_RGB[b];
  if (rgbA === undefined || rgbB === undefined) throw new RangeError('Unknown palette index');
  const [light, dark] = [luminance(rgbA), luminance(rgbB)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
