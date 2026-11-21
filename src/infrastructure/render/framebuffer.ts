import { PALETTE_RGB } from './palette';
import { SLOT_BASE, TRANSPARENT, type Sprite } from './sprite';

export interface BlitOptions {
  readonly flipX?: boolean;
  /** Palette index for each skin slot (slot 0 = 'S', slot 1 = 'T'). */
  readonly slots?: readonly number[];
}

/**
 * A software RGBA frame. All drawing happens here (testable in Node) and the canvas only
 * receives the finished pixels, so the 8-bit look is exact: no anti-aliasing, integer positions.
 */
export class Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  clear(color: number): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) this.setPixel(x, y, color);
    }
  }

  /** Ignores positions outside the frame, so callers never need to clip. */
  setPixel(x: number, y: number, color: number): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const rgb = PALETTE_RGB[color];
    if (rgb === undefined) throw new RangeError(`Unknown palette index ${color}`);
    const offset = (py * this.width + px) * 4;
    this.data[offset] = rgb[0];
    this.data[offset + 1] = rgb[1];
    this.data[offset + 2] = rgb[2];
    this.data[offset + 3] = 255;
  }

  fillRect(x: number, y: number, width: number, height: number, color: number): void {
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) this.setPixel(x + dx, y + dy, color);
    }
  }

  fillCircle(cx: number, cy: number, radius: number, color: number): void {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy <= r2) this.setPixel(cx + dx, cy + dy, color);
      }
    }
  }

  blit(sprite: Sprite, x: number, y: number, options: BlitOptions = {}): void {
    const left = Math.round(x);
    const top = Math.round(y);
    for (let sy = 0; sy < sprite.height; sy += 1) {
      for (let sx = 0; sx < sprite.width; sx += 1) {
        const srcX = options.flipX === true ? sprite.width - 1 - sx : sx;
        const value = sprite.pixels[sy * sprite.width + srcX] ?? TRANSPARENT;
        if (value === TRANSPARENT) continue;
        const color = value >= SLOT_BASE ? options.slots?.[value - SLOT_BASE] : value;
        if (color === undefined) {
          throw new RangeError(`Sprite uses skin slot ${value - SLOT_BASE} but no color was given`);
        }
        this.setPixel(left + sx, top + sy, color);
      }
    }
  }

  /** Copies another frame of the same size over this one (used for the pre-rendered background). */
  copyFrom(other: Framebuffer): void {
    this.data.set(other.data);
  }

  /**
   * Moves the whole picture by whole pixels (screen shake). The edge that is uncovered repeats the
   * outermost row or column, so no hole or flash of color appears.
   */
  shiftBy(dx: number, dy: number): void {
    const shiftX = Math.round(dx);
    const shiftY = Math.round(dy);
    if (shiftX === 0 && shiftY === 0) return;
    const source = this.data.slice();
    for (let y = 0; y < this.height; y += 1) {
      const sy = Math.min(this.height - 1, Math.max(0, y - shiftY));
      for (let x = 0; x < this.width; x += 1) {
        const sx = Math.min(this.width - 1, Math.max(0, x - shiftX));
        const from = (sy * this.width + sx) * 4;
        const to = (y * this.width + x) * 4;
        this.data[to] = source[from] ?? 0;
        this.data[to + 1] = source[from + 1] ?? 0;
        this.data[to + 2] = source[from + 2] ?? 0;
        this.data[to + 3] = source[from + 3] ?? 255;
      }
    }
  }

  /** The RGB of a pixel, for tests and debugging. */
  rgbAt(x: number, y: number): readonly [number, number, number] {
    const offset = (y * this.width + x) * 4;
    return [this.data[offset] ?? 0, this.data[offset + 1] ?? 0, this.data[offset + 2] ?? 0];
  }
}
