import { describe, expect, it } from 'vitest';
import { defaultSave, emptyStats, parseSave, type SaveRules } from './save-data';

const RULES: SaveRules = {
  levelIds: [1, 2, 3],
  goalByLevel: { 1: 100, 2: 120, 3: 150 },
  skinIds: ['classic', 'ocean', 'gold'],
  achievementIds: ['first-hit', 'combo-4'],
  defaultSkin: 'classic',
};

const valid = {
  version: 2,
  playerName: 'Maria',
  points: 120,
  coins: 7,
  highestUnlockedLevel: 2,
  clearedLevels: [1],
  bestScoreByLevel: { 1: 150, 2: 80 },
  ownedSkins: ['classic', 'ocean'],
  equippedSkin: 'ocean',
  stats: {
    rounds: 9,
    wins: 4,
    throws: 80,
    hits: 52,
    bestCombo: 6,
    flawlessWins: 1,
    bestAmmoLeftOnWin: 3,
    totalPoints: 1450,
    hitsByType: { common: 30, swimmer: 15, fiddler: 7 },
  },
  achievements: ['first-hit', 'combo-4'],
  settings: { muted: true, music: false, volume: 0.5, locale: 'pt-BR' },
};

describe('defaultSave', () => {
  it('is a new player: level 1, no points or coins, the free skin, sound on, no language', () => {
    expect(defaultSave(RULES)).toEqual({
      version: 2,
      playerName: '',
      points: 0,
      coins: 0,
      highestUnlockedLevel: 1,
      clearedLevels: [],
      bestScoreByLevel: {},
      ownedSkins: ['classic'],
      equippedSkin: 'classic',
      stats: emptyStats(),
      achievements: [],
      settings: { muted: false, music: true, volume: 1, locale: null },
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

  it('falls back to the default for an unknown version', () => {
    expect(parseSave({ ...valid, version: 3 }, RULES)).toEqual(defaultSave(RULES));
    expect(parseSave({ ...valid, version: undefined }, RULES)).toEqual(defaultSave(RULES));
  });

  it('repairs one bad field without losing the others', () => {
    const result = parseSave({ ...valid, points: -5, highestUnlockedLevel: 'x' }, RULES);
    expect(result.points).toBe(0);
    expect(result.coins).toBe(7);
    expect(result.highestUnlockedLevel).toBe(1);
    expect(result.ownedSkins).toEqual(['classic', 'ocean']);
    expect(result.playerName).toBe('Maria');
  });

  it.each([-1, 1.5, Number.NaN, Infinity, 2e9, '100', null])(
    'rejects the points and coins %j',
    (value) => {
      const result = parseSave({ ...valid, points: value, coins: value }, RULES);
      expect(result.points).toBe(0);
      expect(result.coins).toBe(0);
    },
  );

  it('keeps only cleared levels that exist, once each, in campaign order', () => {
    const result = parseSave({ ...valid, clearedLevels: [3, 'x', 99, 1, 3, 1.5] }, RULES);
    expect(result.clearedLevels).toEqual([1, 3]);
    expect(parseSave({ ...valid, clearedLevels: 'all' }, RULES).clearedLevels).toEqual([]);
  });

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
    expect(result.settings).toEqual({ muted: false, music: true, volume: 1, locale: null });
    expect(parseSave({ ...valid, settings: 'x' }, RULES).settings).toEqual({
      muted: false,
      music: true,
      volume: 1,
      locale: null,
    });
  });

  it('reads a save from before the music setting existed as "music on"', () => {
    const old = { muted: true, volume: 0.5, locale: 'pt-BR' }; // no `music` key
    expect(parseSave({ ...valid, settings: old }, RULES).settings.music).toBe(true);
  });

  it('does not trust inherited or polluting keys', () => {
    const raw = JSON.parse('{"version":2,"__proto__":{"points":999},"points":5}');
    expect(parseSave(raw, RULES).points).toBe(5);
    expect(({} as Record<string, unknown>)['points']).toBeUndefined();
  });
});

describe('parseSave: migrating a version 1 save', () => {
  const v1 = {
    version: 1,
    playerName: 'Maria',
    balance: 120,
    highestUnlockedLevel: 2,
    bestScoreByLevel: { 1: 150, 2: 80 },
    ownedSkins: ['classic', 'ocean'],
    equippedSkin: 'ocean',
    settings: { muted: true, music: false, volume: 0.5, locale: 'pt-BR' },
  };

  it('turns the old balance into the point bank, starts with no coins and keeps the rest', () => {
    expect(parseSave(v1, RULES)).toEqual({
      version: 2,
      playerName: 'Maria',
      points: 120,
      coins: 0,
      highestUnlockedLevel: 2,
      clearedLevels: [1],
      bestScoreByLevel: { 1: 150, 2: 80 },
      ownedSkins: ['classic', 'ocean'],
      equippedSkin: 'ocean',
      stats: emptyStats(),
      achievements: [],
      settings: { muted: true, music: false, volume: 0.5, locale: 'pt-BR' },
    });
  });

  it('counts as cleared every level below the frontier, which a win is what moved', () => {
    expect(parseSave({ ...v1, highestUnlockedLevel: 3 }, RULES).clearedLevels).toEqual([1, 2]);
    expect(
      parseSave({ ...v1, highestUnlockedLevel: 1, bestScoreByLevel: {} }, RULES).clearedLevels,
    ).toEqual([]);
  });

  it('counts the last level as cleared when its best score reached the goal (it never moves the frontier)', () => {
    const atTheEnd = { ...v1, highestUnlockedLevel: 3, bestScoreByLevel: { 3: 150 } };
    expect(parseSave(atTheEnd, RULES).clearedLevels).toEqual([1, 2, 3]);
    const lostThere = { ...v1, highestUnlockedLevel: 3, bestScoreByLevel: { 3: 149 } };
    expect(parseSave(lostThere, RULES).clearedLevels).toEqual([1, 2]);
  });

  it('does not read points, coins or cleared levels from a version 1 save', () => {
    const odd = { ...v1, points: 999, coins: 999, clearedLevels: [3] };
    const result = parseSave(odd, RULES);
    expect(result).toMatchObject({ points: 120, coins: 0, clearedLevels: [1] });
  });

  it('repairs a bad balance like any other field', () => {
    expect(parseSave({ ...v1, balance: 'lots' }, RULES).points).toBe(0);
  });
});

describe('parseSave: stats and achievements (M8)', () => {
  it('reads a save made before achievements with every counter at zero', () => {
    const before: Record<string, unknown> = { ...valid };
    delete before['stats'];
    delete before['achievements'];
    const result = parseSave(before, RULES);
    expect(result.stats).toEqual(emptyStats());
    expect(result.achievements).toEqual([]);
    expect(result.coins).toBe(7); // the rest is untouched
  });

  it('repairs each counter on its own', () => {
    const result = parseSave(
      {
        ...valid,
        stats: { ...valid.stats, hits: -3, wins: 'many', bestCombo: 2.5, rounds: 12 },
      },
      RULES,
    );
    expect(result.stats).toMatchObject({ hits: 0, wins: 0, bestCombo: 0, rounds: 12, throws: 80 });
  });

  it('ignores crab types that do not exist and fills the ones that are missing', () => {
    const result = parseSave(
      { ...valid, stats: { hitsByType: { common: 5, dragon: 99, fiddler: -1 } } },
      RULES,
    );
    expect(result.stats.hitsByType).toEqual({ common: 5, swimmer: 0, fiddler: 0 });
  });

  it.each([null, 7, 'x', [], true])('falls back to empty stats for %j', (stats) => {
    expect(parseSave({ ...valid, stats }, RULES).stats).toEqual(emptyStats());
  });

  it('drops unknown achievement ids and repeats, keeping the order of the catalog', () => {
    const result = parseSave(
      { ...valid, achievements: ['combo-4', 'gone', 'first-hit', 'combo-4', 7] },
      RULES,
    );
    expect(result.achievements).toEqual(['first-hit', 'combo-4']);
  });

  it.each([undefined, null, 'first-hit', { 0: 'first-hit' }])(
    'reads %j as no achievements',
    (achievements) => {
      expect(parseSave({ ...valid, achievements }, RULES).achievements).toEqual([]);
    },
  );
});
