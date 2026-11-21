import { computeIntegerScale, type ScreenRect } from '../../application/viewport';
import type { Framebuffer } from './framebuffer';

/**
 * The only piece that touches the canvas: copies a finished frame onto it and sizes it with an
 * integer scale. Kept deliberately thin (no drawing logic) since it cannot run in Node tests.
 */
export class CanvasPresenter {
  private readonly context: CanvasRenderingContext2D;
  private readonly image: ImageData;

  constructor(
    readonly canvas: HTMLCanvasElement,
    frame: Framebuffer,
  ) {
    const context = canvas.getContext('2d', { alpha: false });
    if (context === null) throw new Error('Canvas 2D is not available in this browser');
    canvas.width = frame.width;
    canvas.height = frame.height;
    this.context = context;
    this.image = new ImageData(frame.data, frame.width, frame.height);
  }

  /** `frame.data` is shared with the ImageData, so presenting is a single putImageData. */
  present(): void {
    this.context.putImageData(this.image, 0, 0);
  }

  /**
   * Fits the canvas in the available box (CSS pixels) with the largest scale that maps every field
   * pixel to a whole number of device pixels (crisp pixels, finer steps on high-density phones).
   */
  fit(availableWidth: number, availableHeight: number, devicePixelRatio = 1): number {
    const scale = computeIntegerScale(availableWidth, availableHeight, devicePixelRatio);
    // Only the width is set: CSS keeps the aspect ratio, so `max-width: 100%` can still shrink it
    // if a window is narrower than the field (then the pixels are no longer perfectly crisp).
    this.canvas.style.width = `${this.canvas.width * scale}px`;
    return scale;
  }

  /** Where the canvas is on screen, for converting pointer positions to field pixels. */
  rect(): ScreenRect {
    const { left, top, width, height } = this.canvas.getBoundingClientRect();
    return { left, top, width, height };
  }
}
