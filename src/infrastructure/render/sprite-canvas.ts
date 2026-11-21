import { Framebuffer } from './framebuffer';
import type { Sprite } from './sprite';

/**
 * Draws a sprite on its own small canvas, for DOM screens that show the art (the level briefing).
 * Same pixels as the game field; the page scales it with `image-rendering: pixelated`.
 */
export function spriteToCanvas(sprite: Sprite): HTMLCanvasElement {
  const frame = new Framebuffer(sprite.width, sprite.height);
  frame.blit(sprite, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  // 3 CSS rem-quarters per sprite pixel: every crab is drawn at the same scale, so sizes compare.
  canvas.style.width = `${sprite.width * 0.1875}rem`;
  canvas
    .getContext('2d')
    ?.putImageData(new ImageData(frame.data, sprite.width, sprite.height), 0, 0);
  return canvas;
}
