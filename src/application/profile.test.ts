import { describe, expect, it, vi } from 'vitest';
import type { SkinCatalog } from '../domain/entities/skin';
import { Profile } from './profile';
import type { ProgressRepository } from './ports/progress-repository';
import type { SaveDataV1, SaveRules } from './save-data';

const RULES: SaveRules = {
  levelIds: [1, 2, 3],
  skinIds: ['classic', 'ocean'],
  defaultSkin: 'classic',
};
const CATALOG: SkinCatalog = [
  { id: 'classic', price: 0 },
  { id: 'ocean', price: 75 },
];

function memoryRepo(stored?: unknown) {
  const saved: SaveDataV1[] = [];
  const repo: ProgressRepository = { load: () => stored, save: (data) => void saved.push(data) };
  return { repo, saved };
}

const make = (stored?: unknown) => {
  const { repo, saved } = memoryRepo(stored);
  return { profile: new Profile(repo, RULES, CATALOG), saved };
};

describe('Profile', () => {
  it('starts as a new player when nothing is stored', () => {
    const { profile, saved } = make();
    expect(profile.data.balance).toBe(0);
    expect(profile.data.highestUnlockedLevel).toBe(1);
    expect(saved).toEqual([]); // reading does not write
  });

  it('loads and repairs a stored save', () => {
    const { profile } = make({ version: 1, balance: 40, ownedSkins: ['ocean', 'nope'] });
    expect(profile.data.balance).toBe(40);
    expect(profile.data.ownedSkins).toEqual(['classic', 'ocean']);
  });

  it('credits the round score to the balance, also after a loss (D12)', () => {
    const { profile, saved } = make();
    profile.recordRound(120, { highestUnlockedLevel: 1, bestScoreByLevel: { 1: 120 } });
    profile.recordRound(30, { highestUnlockedLevel: 1, bestScoreByLevel: { 1: 120 } });
    expect(profile.data.balance).toBe(150);
    expect(saved).toHaveLength(2);
  });

  it('only moves campaign progress forward', () => {
    const { profile } = make({
      version: 1,
      highestUnlockedLevel: 3,
      bestScoreByLevel: { 1: 200 },
    });
    profile.recordRound(10, { highestUnlockedLevel: 1, bestScoreByLevel: { 1: 50, 2: 70 } });
    expect(profile.data.highestUnlockedLevel).toBe(3);
    expect(profile.data.bestScoreByLevel).toEqual({ 1: 200, 2: 70 });
  });

  it('feeds the campaign with the stored progress', () => {
    const { profile } = make({ version: 1, highestUnlockedLevel: 2, bestScoreByLevel: { 1: 9 } });
    expect(profile.progress).toEqual({ highestUnlockedLevel: 2, bestScoreByLevel: { 1: 9 } });
  });

  it('never credits a negative or fractional score', () => {
    const { profile } = make();
    profile.recordRound(-50, { highestUnlockedLevel: 1, bestScoreByLevel: {} });
    profile.recordRound(10.9, { highestUnlockedLevel: 1, bestScoreByLevel: {} });
    expect(profile.data.balance).toBe(10);
  });

  it('buys and equips a skin, storing each step', () => {
    const { profile, saved } = make({ version: 1, balance: 100 });
    expect(profile.buy('ocean')).toBeUndefined();
    expect(profile.data).toMatchObject({ balance: 25, ownedSkins: ['classic', 'ocean'] });
    expect(profile.equip('ocean')).toBeUndefined();
    expect(profile.data.equippedSkin).toBe('ocean');
    expect(saved).toHaveLength(2);
  });

  it('reports why a purchase or equip failed and stores nothing', () => {
    const { profile, saved } = make({ version: 1, balance: 10 });
    expect(profile.buy('ocean')).toBe('insufficient-balance');
    expect(profile.buy('nope')).toBe('unknown-skin');
    expect(profile.equip('ocean')).toBe('not-owned');
    expect(saved).toEqual([]);
  });

  it('stores the cleaned player name and returns it', () => {
    const { profile, saved } = make();
    expect(profile.setPlayerName('  Maria 🦀 ')).toBe('Maria');
    expect(profile.data.playerName).toBe('Maria');
    profile.setPlayerName('Maria');
    expect(saved).toHaveLength(1); // unchanged name: no write
  });

  it('stores settings only when they change', () => {
    const { profile, saved } = make();
    profile.setLocale('pt-BR');
    profile.setLocale('pt-BR');
    profile.setMuted(true);
    profile.setMuted(true);
    expect(profile.data.settings).toEqual({ muted: true, volume: 1, locale: 'pt-BR' });
    expect(saved).toHaveLength(2);
  });

  it('tells listeners about every change, until they unsubscribe', () => {
    const { profile } = make({ version: 1, balance: 100 });
    const listener = vi.fn();
    const off = profile.onChange(listener);
    profile.buy('ocean');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    profile.equip('ocean');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
