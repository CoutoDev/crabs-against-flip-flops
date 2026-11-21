import { describe, expect, it } from 'vitest';
import { CRAB_TYPE_IDS } from '../../domain/entities/crab';
import { SLOT_BASE, TRANSPARENT, type Sprite } from './sprite';
import { DEFAULT_SLIPPER_SLOTS, SPRITES } from './sprites';

const solid = (sprite: Sprite): number => sprite.pixels.filter((v) => v !== TRANSPARENT).length;

describe('sprites', () => {
  it.each(CRAB_TYPE_IDS)('%s has two animation frames of the same size', (type) => {
    const [a, b] = SPRITES.crabs[type];
    expect(b.width).toBe(a.width);
    expect(b.height).toBe(a.height);
    expect(solid(a)).toBeGreaterThan(30);
  });

  it('keeps each crab footprint close to its hit radius (gameplay must match what is drawn)', () => {
    // hit radius in data/crab-types.ts: common 9, swimmer 8, fiddler 6 → drawn ~2×radius wide
    expect(SPRITES.crabs.common[0].width).toBeGreaterThanOrEqual(14);
    expect(SPRITES.crabs.swimmer[0].width).toBeGreaterThanOrEqual(14);
    expect(SPRITES.crabs.fiddler[0].width).toBeLessThan(SPRITES.crabs.common[0].width);
  });

  it('animates by moving only the legs (body rows are identical between frames)', () => {
    const [a, b] = SPRITES.crabs.common;
    const bodyCells = (a.height - 2) * a.width;
    expect([...a.pixels.slice(0, bodyCells)]).toEqual([...b.pixels.slice(0, bodyCells)]);
    expect([...a.pixels]).not.toEqual([...b.pixels]);
  });

  it('draws the swimmer as a recolor of the common crab (same silhouette)', () => {
    const common = SPRITES.crabs.common[0];
    const swimmer = SPRITES.crabs.swimmer[0];
    const silhouette = (s: Sprite) => [...s.pixels].map((v) => v !== TRANSPARENT);
    expect(silhouette(swimmer)).toEqual(silhouette(common));
    expect([...swimmer.pixels]).not.toEqual([...common.pixels]);
  });

  it('has four rotation frames of the flip flop using exactly the two skin slots', () => {
    expect(SPRITES.slipper).toHaveLength(4);
    const slots = new Set<number>();
    for (const frame of SPRITES.slipper) {
      for (const v of frame.pixels) if (v >= SLOT_BASE) slots.add(v - SLOT_BASE);
    }
    expect([...slots].sort()).toEqual([0, 1]);
    expect(DEFAULT_SLIPPER_SLOTS).toHaveLength(2);
    expect(SPRITES.slipper[1].width).toBe(SPRITES.slipper[0].height);
  });

  it('provides growing/fading puff frames and a shadow', () => {
    expect(SPRITES.puff).toHaveLength(3);
    expect(SPRITES.shadow.width).toBeGreaterThan(SPRITES.shadow.height);
  });

  it('keeps all palette indices valid (no stray slot values in static art)', () => {
    const staticSprites = [
      ...CRAB_TYPE_IDS.flatMap((t) => [...SPRITES.crabs[t]]),
      SPRITES.shadow,
      ...SPRITES.puff,
      SPRITES.palm,
    ];
    for (const sprite of staticSprites) {
      for (const v of sprite.pixels) expect(v).toBeLessThan(SLOT_BASE);
    }
  });
});
