import { coinPrice, type ItemCatalog } from '../entities/item';

/** The part of the player's save that the shop reads and changes. */
export interface ShopState {
  /** Coins to spend. Points never buy anything directly: they are converted first (D38). */
  readonly coins: number;
  readonly ownedSkins: readonly string[];
  readonly equippedSkin: string;
}

export type ShopFailure =
  'unknown-item' | 'already-owned' | 'not-for-sale' | 'insufficient-coins' | 'not-owned';

export type ShopResult =
  | { readonly ok: true; readonly state: ShopState }
  | { readonly ok: false; readonly reason: ShopFailure };

/** Pure: returns the new state, or why the purchase is not possible. */
export function buyItem(state: ShopState, catalog: ItemCatalog, itemId: string): ShopResult {
  const item = catalog.find((candidate) => candidate.id === itemId);
  if (item === undefined) return { ok: false, reason: 'unknown-item' };
  if (state.ownedSkins.includes(itemId)) return { ok: false, reason: 'already-owned' };
  const price = coinPrice(item);
  if (price === undefined) return { ok: false, reason: 'not-for-sale' };
  if (state.coins < price) return { ok: false, reason: 'insufficient-coins' };
  return {
    ok: true,
    state: {
      ...state,
      coins: state.coins - price,
      ownedSkins: [...state.ownedSkins, itemId],
    },
  };
}

export function equipSkin(state: ShopState, catalog: ItemCatalog, skinId: string): ShopResult {
  if (!catalog.some((item) => item.id === skinId)) return { ok: false, reason: 'unknown-item' };
  if (!state.ownedSkins.includes(skinId)) return { ok: false, reason: 'not-owned' };
  return { ok: true, state: { ...state, equippedSkin: skinId } };
}
