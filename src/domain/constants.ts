import type { Vec2 } from './geometry';

/** Logical playfield, in pixels (the renderer scales it by an integer factor). */
export const FIELD_WIDTH_PX = 320;
export const FIELD_HEIGHT_PX = 180;

/** Where every flip flop leaves the player's hand. */
export const THROW_ORIGIN: Vec2 = { x: 160, y: 172 };

/** Tolerance added to a crab's hit radius when a flip flop lands. */
export const SLIPPER_RADIUS_PX = 6;

/** Crabs spawn this far outside the field and are removed once this far past the other side. */
export const CRAB_SPAWN_MARGIN_PX = 16;

/** Fixed simulation step (60 Hz). The game loop feeds `step` with this value. */
export const STEP_MS = 1000 / 60;
