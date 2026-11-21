import { COLOR } from './palette';
import { DEFAULT_SLIPPER_SLOTS } from './sprites';

/** Palette index for each skin slot [sole, strap], by skin id (the prices are in data/skins.ts). */
export const SKIN_SLOTS: Readonly<Record<string, readonly [sole: number, strap: number]>> = {
  classic: [COLOR.coral, COLOR.white],
  ocean: [COLOR.sea, COLOR.white],
  lime: [COLOR.lightLeaf, COLOR.sun],
  mangrove: [COLOR.leaf, COLOR.lightSand],
  pink: [COLOR.magenta, COLOR.white],
  midnight: [COLOR.deepSea, COLOR.sun],
  gold: [COLOR.sun, COLOR.coral],
};

/**
 * Colors of the trail a flip flop leaves in the air, newest dot first. Another part of the skin
 * (D15): it costs nothing in play, it is only how the throw looks.
 */
export const SKIN_TRAILS: Readonly<Record<string, readonly number[]>> = {
  classic: [COLOR.white, COLOR.lightSand],
  ocean: [COLOR.sky, COLOR.white],
  lime: [COLOR.lightLeaf, COLOR.leaf],
  mangrove: [COLOR.leaf, COLOR.lightLeaf],
  pink: [COLOR.magenta, COLOR.white],
  midnight: [COLOR.sun, COLOR.white],
  gold: [COLOR.sun, COLOR.white, COLOR.coral],
};

const DEFAULT_TRAIL: readonly number[] = [COLOR.white, COLOR.lightSand];

export function trailForSkin(skinId: string): readonly number[] {
  return SKIN_TRAILS[skinId] ?? DEFAULT_TRAIL;
}

/** Colors of a skin; an unknown id (e.g. a skin removed in a later version) wears the default. */
export function slotsForSkin(skinId: string): readonly number[] {
  return SKIN_SLOTS[skinId] ?? DEFAULT_SLIPPER_SLOTS;
}
