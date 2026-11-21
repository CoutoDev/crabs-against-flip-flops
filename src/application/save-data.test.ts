import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave, type SaveRules } from './save-data';

const RULES: SaveRules = {
  levelIds: [1, 2, 3],
  skinIds: ['classic', 'ocean', 'gold'],
  defaultSkin: 'classic',
};

const valid = {
  version: 1,
  playerName: 'Maria',
  balance: 120,
  highestUnlockedLevel: 2,
  bestScoreByLevel: { 1: 150, 2: 80 },
  ownedSkins: ['classic', 'ocean'],
  equippedSkin: 'ocean',
  settings: { muted: true, volume: 0.5, locale: 'pt-BR' },
};

describe('defaultSave', () => {
  it('is a new player: level 1, no points, the free skin, sound on, no language chosen', () => {
    expect(defaultSave(RULES)).toEqual({
      version: 1,
      playerName: '',
      balance: 0,
      highestUnlockedLevel: 1,
      bestScoreByLevel: {},
      ownedSkins: ['classic'],
      equippedSkin: 'classic',
      settings: { muted: false, volume: 1, locale: null },
    });
  });
});

describe('parseSave', () => {
  it('accepts a valid save as it is', () => {
    expect(parseSave(valid, RULES)).toEqual(valid);
  });

  it('survives a JSON round trip', () => {
    expect(parseSave(JSON.parse(JSON.stringify(valid)), RULES)).toEqual(valid);
  });

  it.each([undefined, null, 42, 'text', [], true])('falls back to the default for %j', (raw) => {
    expect(parseSave(raw, RULES)).toEqual(defaultSave(RULES));
  });

  it('falls back to the default for an unknown version (no migration exists yet)', () => {
    expect(parseSave({ ...valid, version: 2 }, RULES)).toEqual(defaultSave(RULES));
    expect(parseSave({ ...valid, version: undefined }, RULES)).toEqual(defaultSave(RULES));
  });

  it('repairs one bad field without losing the others', () => {
    const result = parseSave({ ...valid, balance: -5, highestUnlockedLevel: 'x' }, RULES);
    expect(result.balance).toBe(0);
    expect(result.highestUnlockedLevel).toBe(1);
    expect(result.ownedSkins).toEqual(['classic', 'ocean']);
    expect(result.playerName).toBe('Maria');
  });

  it.each([-1, 1.5, Number.NaN, Infinity, 2e9, '100', null])(
    'rejects the balance %j',
    (balance) => {
      expect(parseSave({ ...valid, balance }, RULES).balance).toBe(0);
    },
  );

  it('rejects an unlocked level that does not exist', () => {
    expect(parseSave({ ...valid, highestUnlockedLevel: 99 }, RULES).highestUnlockedLevel).toBe(1);
    expect(parseSave({ ...valid, highestUnlockedLevel: 2.5 }, RULES).highestUnlockedLevel).toBe(1);
  });

  it('keeps only best scores of real levels with sane values', () => {
    const result = parseSave(
      { ...valid, bestScoreByLevel: { 1: 10, 99: 50, x: 5, 2: -3, 3: 'a', 0: 7 } },
      RULES,
    );
    expect(result.bestScoreByLevel).toEqual({ 1: 10 });
  });

  it('ignores a best-score table that is not an object', () => {
    expect(parseSave({ ...valid, bestScoreByLevel: [1, 2] }, RULES).bestScoreByLevel).toEqual({});
  });

  it('drops unknown skins and non-strings, and always owns the free skin', () => {
    const result = parseSave({ ...valid, ownedSkins: ['ocean', 'unicorn', 7, 'ocean'] }, RULES);
    expect(result.ownedSkins).toEqual(['classic', 'ocean']);
    expect(parseSave({ ...valid, ownedSkins: 'ocean' }, RULES).ownedSkins).toEqual(['classic']);
  });

  it('equips only a skin that is owned, else goes back to the free one', () => {
    expect(parseSave({ ...valid, equippedSkin: 'gold' }, RULES).equippedSkin).toBe('classic');
    expect(parseSave({ ...valid, equippedSkin: 'unicorn' }, RULES).equippedSkin).toBe('classic');
    expect(parseSave({ ...valid, equippedSkin: 5 }, RULES).equippedSkin).toBe('classic');
  });

  it('cleans the player name the same way the input does', () => {
    expect(parseSave({ ...valid, playerName: '  <i>Bob</i> 🦀 ' }, RULES).playerName).toBe('iBobi');
    expect(parseSave({ ...valid, playerName: 12 }, RULES).playerName).toBe('');
  });

  it('repairs each setting on its own', () => {
    const result = parseSave(
      { ...valid, settings: { muted: 'yes', volume: 7, locale: 'fr' } },
      RULES,
    );
    expect(result.settings).toEqual({ muted: false, volume: 1, locale: null });
    expect(parseSave({ ...valid, settings: 'x' }, RULES).settings).toEqual({
      muted: false,
      volume: 1,
      locale: null,
    });
  });

  it('does not trust inherited or polluting keys', () => {
    const raw = JSON.parse('{"version":1,"__proto__":{"balance":999},"balance":5}');
    expect(parseSave(raw, RULES).balance).toBe(5);
    expect(({} as Record<string, unknown>)['balance']).toBeUndefined();
  });
});
