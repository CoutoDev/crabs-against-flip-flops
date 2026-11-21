import type { CrabType } from '../../domain/entities/crab';
import { COLOR } from './palette';
import { parseSprite, recolor, rotate90, symmetric, type Sprite } from './sprite';

/*
 * All art lives here as text. Legend: '.' transparent · '0'-'9','a'-'f' palette index ·
 * 'S' / 'T' skin slots (flip flop sole / strap). Rows are checked by parseSprite (same width).
 * The palette is in palette.ts: 0 ink, 2 sea, 3 sky, a crab red, b coral, c sun, d white.
 */

// ── Crabs ────────────────────────────────────────────────────────────────────────────────────
// 16×12 common crab: raised pincers, eyes, shell with highlights. Frames differ only in the legs.
const COMMON_BODY = [
  '0.0..........0.0',
  '0b0..dd..dd..0b0',
  '0bb0.d0..0d.0bb0',
  '.0b0000000000b0.',
  '..00aaaaaaaa00..',
  '.0aaaaaaaaaaaa0.',
  '0aaabaaaaaabaaa0',
  '.0aaaaaaaaaaaa0.',
  '..0aaaaaaaaaa0..',
  '...0000000000...',
];
const COMMON_A = parseSprite('crab.common.0', [
  ...COMMON_BODY,
  '..0.0.0..0.0.0..',
  '.0.0.0....0.0.0.',
]);
const COMMON_B = parseSprite('crab.common.1', [
  ...COMMON_BODY,
  '.0.0.0....0.0.0.',
  '0.0.0......0.0.0',
]);

// Swimmer (siri): same silhouette, blue palette, so it reads as a different animal at a glance.
const SWIMMER_MAP = { [COLOR.crabRed]: COLOR.sea, [COLOR.coral]: COLOR.sky } as const;

// 12×8 fiddler crab: one huge coral claw, small yellow body.
const FIDDLER_BODY = [
  '0bb0....0d0.',
  '0bbb0...0.0.',
  '0bbbb0cccc0.',
  '.0bb0cccccc0',
  '..00cccccc0.',
  '....cccccc0.',
];
const FIDDLER_A = parseSprite('crab.fiddler.0', [...FIDDLER_BODY, '...0.0.0.0..', '..0.0.0.0...']);
const FIDDLER_B = parseSprite('crab.fiddler.1', [...FIDDLER_BODY, '..0.0.0.0...', '...0.0.0.0..']);

const CRABS: Readonly<Record<CrabType, readonly [Sprite, Sprite]>> = {
  common: [COMMON_A, COMMON_B],
  swimmer: [recolor(COMMON_A, SWIMMER_MAP), recolor(COMMON_B, SWIMMER_MAP)],
  fiddler: [FIDDLER_A, FIDDLER_B],
};

// ── Flip flop (top view): S = sole, T = strap, both from the equipped skin ───────────────────
const SLIPPER_UP = parseSprite('slipper', [
  '..000..',
  '.0SSS0.',
  '0SSSSS0',
  '0STSTS0',
  '0SSTSS0',
  '0SSTSS0',
  '0SSSSS0',
  '0SSSSS0',
  '0SSSSS0',
  '.0SSS0.',
  '.0SSS0.',
  '..000..',
]);
const SLIPPER_RIGHT = rotate90(SLIPPER_UP);
const SLIPPER_DOWN = rotate90(SLIPPER_RIGHT);
const SLIPPER_LEFT = rotate90(SLIPPER_DOWN);

// ── Small effects ────────────────────────────────────────────────────────────────────────────
const SHADOW = parseSprite('shadow', ['..7777..', '.777777.', '..7777..']);

const PUFF: readonly Sprite[] = [
  parseSprite('puff.0', ['..dd..', '.dddd.', '.dddd.', '..dd..']),
  parseSprite('puff.1', ['.d.dd.d.', 'dd....dd', '.d....d.', 'dd....dd', '.d.dd.d.']),
  parseSprite('puff.2', ['d..d..d.', '.d....d.', '........', '.d....d.', 'd..d..d.']),
];

// ── Scenery ──────────────────────────────────────────────────────────────────────────────────
const PALM = symmetric('palm', [
  '...99999',
  '.9998899',
  '99889988',
  '9889.998',
  '88...998',
  '.....887',
  '......77',
  '.....777',
  '.....77.',
  '.....77.',
  '.....77.',
  '.....777',
  '.....77.',
  '.....77.',
  '.....77.',
  '.....777',
  '.....77.',
  '.....77.',
  '.....77.',
  '....0770',
]);

export const SPRITES = {
  crabs: CRABS,
  /** Rotation frames: up, right, down, left. */
  slipper: [SLIPPER_UP, SLIPPER_RIGHT, SLIPPER_DOWN, SLIPPER_LEFT] as const,
  shadow: SHADOW,
  puff: PUFF,
  palm: PALM,
} as const;

/** Default flip flop colors for the two skin slots [sole, strap]. */
export const DEFAULT_SLIPPER_SLOTS: readonly number[] = [COLOR.coral, COLOR.white];
