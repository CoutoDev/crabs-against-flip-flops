import { describe, expect, it } from 'vitest';
import type { SkinCatalog } from '../entities/skin';
import { buySkin, equipSkin, type ShopState } from './shop';

const CATALOG: SkinCatalog = [
  { id: 'classic', price: 0 },
  { id: 'ocean', price: 75 },
  { id: 'gold', price: 750 },
];

const state = (overrides: Partial<ShopState> = {}): ShopState => ({
  balance: 100,
  ownedSkins: ['classic'],
  equippedSkin: 'classic',
  ...overrides,
});

describe('buySkin', () => {
  it('takes the price from the balance and adds the skin to the collection', () => {
    const result = buySkin(state(), CATALOG, 'ocean');
    expect(result).toEqual({
      ok: true,
      state: { balance: 25, ownedSkins: ['classic', 'ocean'], equippedSkin: 'classic' },
    });
  });

  it('does not equip what was just bought: that is a separate choice', () => {
    const result = buySkin(state(), CATALOG, 'ocean');
    expect(result.ok && result.state.equippedSkin).toBe('classic');
  });

  it('allows spending the balance down to exactly zero', () => {
    const result = buySkin(state({ balance: 75 }), CATALOG, 'ocean');
    expect(result.ok && result.state.balance).toBe(0);
  });

  it('refuses when the balance is short, changing nothing', () => {
    expect(buySkin(state({ balance: 74 }), CATALOG, 'ocean')).toEqual({
      ok: false,
      reason: 'insufficient-balance',
    });
  });

  it('refuses a skin the player already owns, without charging again', () => {
    const owned = state({ ownedSkins: ['classic', 'ocean'] });
    expect(buySkin(owned, CATALOG, 'ocean')).toEqual({ ok: false, reason: 'already-owned' });
  });

  it('refuses a skin that is not in the catalog', () => {
    expect(buySkin(state(), CATALOG, 'unicorn')).toEqual({ ok: false, reason: 'unknown-skin' });
  });

  it('does not mutate the state it was given', () => {
    const before = state();
    buySkin(before, CATALOG, 'ocean');
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
    expect(equipSkin(odd, CATALOG, 'unicorn')).toEqual({ ok: false, reason: 'unknown-skin' });
  });
});
