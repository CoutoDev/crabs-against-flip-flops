import { describe, expect, it } from 'vitest';
import type { ItemCatalog } from '../entities/item';
import { buyItem, equipSkin, type ShopState } from './shop';

const CATALOG: ItemCatalog = [
  { id: 'classic', kind: 'skin', acquire: { coins: 0 } },
  { id: 'ocean', kind: 'skin', acquire: { coins: 40 } },
  { id: 'gold', kind: 'skin', acquire: { coins: 600 } },
  { id: 'trophy', kind: 'skin', acquire: { achievement: 'first-hit' } },
];

const state = (overrides: Partial<ShopState> = {}): ShopState => ({
  coins: 100,
  ownedSkins: ['classic'],
  equippedSkin: 'classic',
  ...overrides,
});

describe('buyItem', () => {
  it('takes the price in coins and adds the skin to the collection', () => {
    const result = buyItem(state(), CATALOG, 'ocean');
    expect(result).toEqual({
      ok: true,
      state: { coins: 60, ownedSkins: ['classic', 'ocean'], equippedSkin: 'classic' },
    });
  });

  it('does not equip what was just bought: that is a separate choice', () => {
    const result = buyItem(state(), CATALOG, 'ocean');
    expect(result.ok && result.state.equippedSkin).toBe('classic');
  });

  it('allows spending the coins down to exactly zero', () => {
    const result = buyItem(state({ coins: 40 }), CATALOG, 'ocean');
    expect(result.ok && result.state.coins).toBe(0);
  });

  it('refuses when the coins are short, changing nothing', () => {
    expect(buyItem(state({ coins: 39 }), CATALOG, 'ocean')).toEqual({
      ok: false,
      reason: 'insufficient-coins',
    });
  });

  it('refuses a skin the player already owns, without charging again', () => {
    const owned = state({ ownedSkins: ['classic', 'ocean'] });
    expect(buyItem(owned, CATALOG, 'ocean')).toEqual({ ok: false, reason: 'already-owned' });
  });

  it('refuses an item earned by an achievement: it is never for sale', () => {
    expect(buyItem(state({ coins: 9999 }), CATALOG, 'trophy')).toEqual({
      ok: false,
      reason: 'not-for-sale',
    });
  });

  it('refuses a skin that is not in the catalog', () => {
    expect(buyItem(state(), CATALOG, 'unicorn')).toEqual({ ok: false, reason: 'unknown-item' });
  });

  it('does not mutate the state it was given', () => {
    const before = state();
    buyItem(before, CATALOG, 'ocean');
    expect(before).toEqual(state());
  });
});

describe('equipSkin', () => {
  it('equips an owned skin', () => {
    const owned = state({ ownedSkins: ['classic', 'ocean'] });
    expect(equipSkin(owned, CATALOG, 'ocean')).toEqual({
      ok: true,
      state: { ...owned, equippedSkin: 'ocean' },
    });
  });

  it('refuses a skin that has not been bought', () => {
    expect(equipSkin(state(), CATALOG, 'ocean')).toEqual({ ok: false, reason: 'not-owned' });
  });

  it('refuses an unknown skin even if a corrupted save claims to own it', () => {
    const odd = state({ ownedSkins: ['classic', 'unicorn'] });
    expect(equipSkin(odd, CATALOG, 'unicorn')).toEqual({ ok: false, reason: 'unknown-item' });
  });
});
