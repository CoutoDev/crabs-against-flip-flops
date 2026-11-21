import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN_ID, SKINS } from '../../data/skins';
import { SKIN_SLOTS, SKIN_TRAILS, slotsForSkin, trailForSkin } from './skin-slots';
import { DEFAULT_SLIPPER_SLOTS } from './sprites';

describe('skins', () => {
  it('has colors for every skin of the catalog, and none for skins that do not exist', () => {
    expect(Object.keys(SKIN_SLOTS).sort()).toEqual(SKINS.map((skin) => skin.id).sort());
  });

  it('gives every skin its own pair of colors', () => {
    const pairs = SKINS.map((skin) => slotsForSkin(skin.id).join('/'));
    expect(new Set(pairs).size).toBe(SKINS.length);
  });

  it('keeps sole and strap apart, so the strap can be seen', () => {
    for (const skin of SKINS) {
      const [sole, strap] = slotsForSkin(skin.id);
      expect(sole, skin.id).not.toBe(strap);
    }
  });

  it('the free skin is the original look', () => {
    expect(slotsForSkin(DEFAULT_SKIN_ID)).toEqual(DEFAULT_SLIPPER_SLOTS);
  });

  it('falls back to the original look for an unknown skin', () => {
    expect(slotsForSkin('removed-in-v2')).toBe(DEFAULT_SLIPPER_SLOTS);
  });

  it('has a trail for every skin of the catalog, each one different', () => {
    expect(Object.keys(SKIN_TRAILS).sort()).toEqual(SKINS.map((skin) => skin.id).sort());
    const trails = SKINS.map((skin) => trailForSkin(skin.id).join('/'));
    expect(new Set(trails).size).toBe(SKINS.length);
    for (const skin of SKINS) expect(trailForSkin(skin.id).length).toBeGreaterThan(0);
  });

  it('falls back to the default trail for an unknown skin', () => {
    expect(trailForSkin('removed-in-v2')).toEqual(trailForSkin('classic'));
  });
});
