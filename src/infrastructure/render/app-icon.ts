import { Framebuffer } from './framebuffer';
import { COLOR } from './palette';
import { SPRITES } from './sprites';

/** The picture is drawn on a 32×32 grid of big pixels and scaled by a whole number. */
const GRID = 32;

/**
 * The app icon (home screen / install): the common crab on the beach, drawn with the game's own
 * sprite and palette. `size` must be a multiple of 32 so every art pixel is a whole block. It is
 * also safe as a maskable icon: the crab fits in the central 60%.
 */
export function renderAppIcon(size: number): Framebuffer {
  if (size % GRID !== 0) throw new RangeError(`Icon size must be a multiple of ${GRID}`);
  const art = new Framebuffer(GRID, GRID);
  art.fillRect(0, 0, GRID, GRID, COLOR.sky);
  art.fillRect(0, 12, GRID, 8, COLOR.sea);
  art.fillRect(0, 20, GRID, 12, COLOR.sand);
  art.fillRect(0, 20, GRID, 1, COLOR.darkSand);
  art.fillCircle(25, 6, 3, COLOR.sun);
  const crab = SPRITES.crabs.common[0];
  art.blit(SPRITES.shadow, 12, 24);
  art.blit(crab, (GRID - crab.width) / 2, 13);

  const scale = size / GRID;
  const icon = new Framebuffer(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = art.rgbAt(Math.floor(x / scale), Math.floor(y / scale));
      const at = (y * size + x) * 4;
      icon.data[at] = r;
      icon.data[at + 1] = g;
      icon.data[at + 2] = b;
      icon.data[at + 3] = 255;
    }
  }
  return icon;
}
