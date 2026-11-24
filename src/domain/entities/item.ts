/**
 * Something the shop can hold (D35). Today every item is a skin, a cosmetic for the flip flop
 * (D15) that never changes how the game plays; the powers of M9 will be another kind. The domain
 * only knows how an item is obtained; its looks live in the renderer, keyed by `id`.
 */
export type ItemKind = 'skin';

/**
 * How an item is obtained: bought with coins (0 coins means it is owned from the start), or earned
 * by an achievement (M8) and never for sale. An item is one or the other, never both.
 */
export type Acquire = { readonly coins: number } | { readonly achievement: string };

export interface ShopItem {
  readonly id: string;
  readonly kind: ItemKind;
  readonly acquire: Acquire;
}

export type ItemCatalog = readonly ShopItem[];

/** The coin price of an item, or `undefined` when it cannot be bought. */
export function coinPrice(item: ShopItem): number | undefined {
  return 'coins' in item.acquire ? item.acquire.coins : undefined;
}
