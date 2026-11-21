import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from '../../domain/constants';
import type { Biome } from '../../domain/entities/level';
import { Framebuffer } from './framebuffer';
import { COLOR } from './palette';
import { SPRITES } from './sprites';

interface BiomeTheme {
  readonly sky: number;
  readonly sea: number;
  readonly foam: number;
  readonly ground: number;
  readonly groundDark: number;
  readonly speck: number;
  readonly sun: number | undefined;
  readonly palms: boolean;
}

const THEMES: Readonly<Record<Biome, BiomeTheme>> = {
  beach: {
    sky: COLOR.sky,
    sea: COLOR.sea,
    foam: COLOR.white,
    ground: COLOR.sand,
    groundDark: COLOR.darkSand,
    speck: COLOR.lightSand,
    sun: COLOR.sun,
    palms: true,
  },
  rocks: {
    sky: COLOR.sky,
    sea: COLOR.sea,
    foam: COLOR.white,
    ground: COLOR.darkSand,
    groundDark: COLOR.mud,
    speck: COLOR.gray,
    sun: COLOR.sun,
    palms: false,
  },
  mangrove: {
    sky: COLOR.lightLeaf,
    sea: COLOR.leaf,
    foam: COLOR.lightLeaf,
    ground: COLOR.mud,
    groundDark: COLOR.ink,
    speck: COLOR.darkSand,
    sun: undefined,
    palms: true,
  },
  night: {
    sky: COLOR.deepSea,
    sea: COLOR.ink,
    foam: COLOR.gray,
    ground: COLOR.darkSand,
    groundDark: COLOR.mud,
    speck: COLOR.sand,
    sun: COLOR.lightSand,
    palms: true,
  },
};

// The sea ends above the crabs' lanes (data/levels.ts: laneY starts at 150), so the sand is playfield.
const HORIZON_Y = 60;
const SEA_BOTTOM_Y = 116;

/** Deterministic noise in [0, 1): the same pixel always gets the same value. */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Draws a whole biome once; the scene copies it each frame instead of repainting the scenery. */
export function renderBackground(biome: Biome): Framebuffer {
  const theme = THEMES[biome];
  const fb = new Framebuffer(FIELD_WIDTH_PX, FIELD_HEIGHT_PX);

  fb.fillRect(0, 0, FIELD_WIDTH_PX, HORIZON_Y, theme.sky);
  if (theme.sun !== undefined) fb.fillCircle(FIELD_WIDTH_PX - 36, 28, 10, theme.sun);

  fb.fillRect(0, HORIZON_Y, FIELD_WIDTH_PX, SEA_BOTTOM_Y - HORIZON_Y, theme.sea);
  for (let x = 0; x < FIELD_WIDTH_PX; x += 1) {
    // Gentle wave crests and foam along the shoreline.
    if (hash(x, 1) < 0.07) fb.setPixel(x, HORIZON_Y + 4 + Math.floor(hash(x, 2) * 40), theme.foam);
    if (Math.sin(x / 7) > 0.2) fb.setPixel(x, SEA_BOTTOM_Y - 1, theme.foam);
  }
  fb.fillRect(0, HORIZON_Y, FIELD_WIDTH_PX, 1, COLOR.ink);

  fb.fillRect(0, SEA_BOTTOM_Y, FIELD_WIDTH_PX, FIELD_HEIGHT_PX - SEA_BOTTOM_Y, theme.ground);
  for (let y = SEA_BOTTOM_Y; y < FIELD_HEIGHT_PX; y += 1) {
    for (let x = 0; x < FIELD_WIDTH_PX; x += 1) {
      const n = hash(x, y);
      if (n < 0.03) fb.setPixel(x, y, theme.speck);
      else if (n > 0.975) fb.setPixel(x, y, theme.groundDark);
    }
  }
  // Wet strip where the water just left the ground.
  fb.fillRect(0, SEA_BOTTOM_Y, FIELD_WIDTH_PX, 2, theme.groundDark);

  if (theme.palms) {
    fb.blit(SPRITES.palm, 4, HORIZON_Y - 16);
    fb.blit(SPRITES.palm, FIELD_WIDTH_PX - 4 - SPRITES.palm.width, HORIZON_Y - 8);
  }
  return fb;
}
