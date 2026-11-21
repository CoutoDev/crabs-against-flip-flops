import type { SkinCatalog } from '../domain/entities/skin';

/** Everyone owns and wears this one from the start. */
export const DEFAULT_SKIN_ID = 'classic';

/**
 * The shop catalog (D15, prices approved on 2026-11-21): color-only skins, cheapest first. A round
 * earns roughly 100 to 450 points, so the first skin is one good round away and the last one is a
 * long-term goal. Names are `skins.<id>.name` in the catalogs; colors are in the renderer
 * (`skin-slots.ts`).
 */
export const SKINS: SkinCatalog = [
  { id: DEFAULT_SKIN_ID, price: 0 },
  { id: 'ocean', price: 75 },
  { id: 'lime', price: 125 },
  { id: 'mangrove', price: 200 },
  { id: 'pink', price: 300 },
  { id: 'midnight', price: 400 },
  { id: 'gold', price: 750 },
];
