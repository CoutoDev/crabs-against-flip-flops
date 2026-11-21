import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from '../domain/constants';
import { type Vec2 } from '../domain/geometry';

/** Largest whole-number zoom that fits the 320×180 field in the available space (at least 1). */
export function computeIntegerScale(availableWidth: number, availableHeight: number): number {
  const fit = Math.min(availableWidth / FIELD_WIDTH_PX, availableHeight / FIELD_HEIGHT_PX);
  return Math.max(1, Math.floor(fit));
}

export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Converts a pointer position (CSS pixels, relative to the viewport) into field pixels.
 * Returns undefined when the element has no size yet. The result may lie outside the field;
 * the domain clamps it.
 */
export function clientToField(
  clientX: number,
  clientY: number,
  rect: ScreenRect,
): Vec2 | undefined {
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD_WIDTH_PX,
    y: ((clientY - rect.top) / rect.height) * FIELD_HEIGHT_PX,
  };
}
