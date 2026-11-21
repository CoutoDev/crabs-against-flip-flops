import type { SkinCatalog } from '../entities/skin';

/** The part of the player's save that the shop reads and changes. */
export interface ShopState {
  readonly balance: number;
  readonly ownedSkins: readonly string[];
  readonly equippedSkin: string;
}

export type ShopFailure = 'unknown-skin' | 'already-owned' | 'insufficient-balance' | 'not-owned';

export type ShopResult =
  | { readonly ok: true; readonly state: ShopState }
  | { readonly ok: false; readonly reason: ShopFailure };

/** Pure: returns the new state, or why the purchase is not possible. */
export function buySkin(state: ShopState, catalog: SkinCatalog, skinId: string): ShopResult {
  const skin = catalog.find((candidate) => candidate.id === skinId);
  if (skin === undefined) return { ok: false, reason: 'unknown-skin' };
  if (state.ownedSkins.includes(skinId)) return { ok: false, reason: 'already-owned' };
  if (state.balance < skin.price) return { ok: false, reason: 'insufficient-balance' };
  return {
    ok: true,
    state: {
      ...state,
      balance: state.balance - skin.price,
      ownedSkins: [...state.ownedSkins, skinId],
    },
  };
}

export function equipSkin(state: ShopState, catalog: SkinCatalog, skinId: string): ShopResult {
  if (!catalog.some((skin) => skin.id === skinId)) return { ok: false, reason: 'unknown-skin' };
  if (!state.ownedSkins.includes(skinId)) return { ok: false, reason: 'not-owned' };
  return { ok: true, state: { ...state, equippedSkin: skinId } };
}
