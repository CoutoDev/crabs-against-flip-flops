import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from '../domain/constants';
import { clamp, type Vec2 } from '../domain/geometry';

/** Keyboard aiming cursor: where it starts, and how far arrow keys move it. */
export const DEFAULT_AIM: Vec2 = { x: FIELD_WIDTH_PX / 2, y: 110 };
export const AIM_STEP_PX = 8;
export const AIM_FAST_STEP_PX = 24;

export type AimDirection = -1 | 0 | 1;

export function moveAim(aim: Vec2, dx: AimDirection, dy: AimDirection, stepPx: number): Vec2 {
  return {
    x: clamp(aim.x + dx * stepPx, 0, FIELD_WIDTH_PX),
    y: clamp(aim.y + dy * stepPx, 0, FIELD_HEIGHT_PX),
  };
}
