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

/** Colors of a skin; an unknown id (e.g. a skin removed in a later version) wears the default. */
export function slotsForSkin(skinId: string): readonly number[] {
  return SKIN_SLOTS[skinId] ?? DEFAULT_SLIPPER_SLOTS;
}
