import { describe, expect, it } from 'vitest';
import { SPRITES } from './sprites';
import { THEMES } from './background';
import { contrastRatio, COLOR } from './palette';
import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from '../../domain/constants';
import { renderBackground } from './background';
import type { Biome } from '../../domain/entities/level';

const BIOMES: readonly Biome[] = ['beach', 'rocks', 'mangrove', 'night'];

describe('biome backgrounds', () => {
  it.each(BIOMES)('%s paints every pixel', (biome) => {
    const fb = renderBackground(biome);
    expect(fb.width).toBe(FIELD_WIDTH_PX);
    expect(fb.height).toBe(FIELD_HEIGHT_PX);
    for (let i = 3; i < fb.data.length; i += 4) expect(fb.data[i]).toBe(255);
  });

  it('looks different in every biome', () => {
    const frames = BIOMES.map((biome) => renderBackground(biome).data);
    for (let a = 0; a < frames.length; a += 1) {
      for (let b = a + 1; b < frames.length; b += 1) expect(frames[a]).not.toEqual(frames[b]);
    }
  });

  it('has a different ground color in every biome, so the player feels the change', () => {
    const grounds = BIOMES.map((biome) => THEMES[biome].ground);
    expect(new Set(grounds).size).toBe(BIOMES.length);
  });

  // Crabs are drawn with an ink outline, so each one is readable if either its body or its
  // outline stands out from the ground (the picture itself is also checked by eye).
  const BODY_COLORS = {
    common: COLOR.crabRed,
    swimmer: COLOR.sea,
    fiddler: COLOR.sun,
  } as const;
  it.each(BIOMES)('keeps every crab type readable on the %s ground', (biome) => {
    const { ground } = THEMES[biome];
    for (const body of Object.values(BODY_COLORS)) {
      const best = Math.max(contrastRatio(body, ground), contrastRatio(COLOR.ink, ground));
      expect(best).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('draws swimmers and fiddlers differently from common crabs', () => {
    const frame = (type: 'common' | 'swimmer' | 'fiddler') => [...SPRITES.crabs[type][0].pixels];
    expect(frame('swimmer')).not.toEqual(frame('common'));
    expect(SPRITES.crabs.fiddler[0].width).not.toBe(SPRITES.crabs.common[0].width);
  });
});
