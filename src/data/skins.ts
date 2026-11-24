import type { ItemCatalog } from '../domain/entities/item';

/** Everyone owns and wears this one from the start. */
export const DEFAULT_SKIN_ID = 'classic';

/**
 * The shop catalog (D15): color-only skins, cheapest first, priced in coins (D35, a starting point
 * accepted on 2026-11-23 and to be tuned by playtest). With 5 points per coin the whole catalog is
 * 1,350 coins = 6,750 points, about two passes through the campaign. Names are `skins.<id>.name`
 * in the catalogs; colors are in the renderer (`skin-slots.ts`).
 */
export const SKINS: ItemCatalog = [
  { id: DEFAULT_SKIN_ID, kind: 'skin', acquire: { coins: 0 } },
  { id: 'ocean', kind: 'skin', acquire: { coins: 40 } },
  { id: 'lime', kind: 'skin', acquire: { coins: 80 } },
  { id: 'mangrove', kind: 'skin', acquire: { coins: 130 } },
  { id: 'pink', kind: 'skin', acquire: { coins: 200 } },
  { id: 'midnight', kind: 'skin', acquire: { coins: 300 } },
  { id: 'gold', kind: 'skin', acquire: { coins: 600 } },
];
