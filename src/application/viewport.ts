import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from '../domain/constants';
import { type Vec2 } from '../domain/geometry';

/**
 * Largest zoom that fits the field in the available space (CSS pixels) while keeping every field
 * pixel an exact whole number of DEVICE pixels, so the pixel art stays crisp. On a 3x phone screen
 * this allows steps of 1/3 CSS px; on a regular screen (ratio 1) steps are whole CSS pixels.
 * Returns the zoom in CSS pixels per field pixel (at least one device pixel).
 */
export function computeIntegerScale(
  availableWidth: number,
  availableHeight: number,
  devicePixelRatio = 1,
): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio >= 1 ? devicePixelRatio : 1;
  const fit = Math.min(
    (availableWidth * ratio) / FIELD_WIDTH_PX,
    (availableHeight * ratio) / FIELD_HEIGHT_PX,
  );
  return Math.max(1, Math.floor(fit)) / ratio;
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
