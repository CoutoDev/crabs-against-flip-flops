import { describe, expect, it, vi } from 'vitest';
import type { ItemCatalog } from '../domain/entities/item';
import {
  Profile,
  SAVE_DELAY_MS,
  type AchievementRules,
  type EconomyRules,
  type Later,
  type RoundRecord,
} from './profile';
import type { ProgressRepository } from './ports/progress-repository';
import type { SaveData, SaveRules } from './save-data';

const RULES: SaveRules = {
  levelIds: [1, 2, 3],
  goalByLevel: { 1: 100, 2: 120, 3: 150 },
  skinIds: ['classic', 'ocean', 'ember'],
  achievementIds: ['first-hit', 'combo-4', 'flawless-win', 'clear-beach'],
  defaultSkin: 'classic',
};
const CATALOG: ItemCatalog = [
  { id: 'classic', kind: 'skin', acquire: { coins: 0 } },
  { id: 'ocean', kind: 'skin', acquire: { coins: 40 } },
  { id: 'ember', kind: 'skin', acquire: { achievement: 'flawless-win' } },
];
const ACHIEVEMENTS: AchievementRules = {
  catalog: [
    { id: 'first-hit', condition: { kind: 'hits', atLeast: 1 }, coins: 5 },
    { id: 'combo-4', condition: { kind: 'combo', atLeast: 4 }, coins: 10 },
    { id: 'flawless-win', condition: { kind: 'flawlessWin' } },
    { id: 'clear-beach', condition: { kind: 'biomeCleared', biome: 'beach' }, coins: 12 },
  ],
  levels: [
    { id: 1, biome: 'beach' },
    { id: 2, biome: 'beach' },
    { id: 3, biome: 'rocks' },
  ],
};
const ECONOMY: EconomyRules = { pointsPerCoin: 5, replayPercent: 50 };
const NO_PROGRESS = { highestUnlockedLevel: 1, bestScoreByLevel: {} };

function memoryRepo(stored?: unknown) {
  const saved: SaveData[] = [];
  const repo: ProgressRepository = { load: () => stored, save: (data) => void saved.push(data) };
  return { repo, saved };
}

const make = (stored?: unknown) => {
  const { repo, saved } = memoryRepo(stored);
  return { profile: new Profile(repo, RULES, CATALOG, ECONOMY, ACHIEVEMENTS), saved };
};

describe('Profile', () => {
  it('starts as a new player when nothing is stored', () => {
    const { profile, saved } = make();
    expect(profile.data.points).toBe(0);
    expect(profile.data.coins).toBe(0);
    expect(profile.data.highestUnlockedLevel).toBe(1);
    expect(saved).toEqual([]); // reading does not write
  });

  it('loads and repairs a stored save', () => {
    const { profile } = make({ version: 2, points: 40, coins: 3, ownedSkins: ['ocean', 'nope'] });
    expect(profile.data).toMatchObject({ points: 40, coins: 3 });
    expect(profile.data.ownedSkins).toEqual(['classic', 'ocean']);
  });

  it('loads a version 1 save as a version 2 one, keeping the old balance as points', () => {
    const { profile, saved } = make({ version: 1, balance: 40 });
    expect(profile.data).toMatchObject({ version: 2, points: 40, coins: 0 });
    expect(saved).toEqual([]); // migrating in memory does not write until something changes
  });

  describe('recordRound (D12, D38)', () => {
    /** A round with no hits (so no achievement is earned by accident) unless `extra` says so. */
    const round = (
      levelId: number,
      score: number,
      won: boolean,
      extra: Partial<RoundRecord> = {},
    ): RoundRecord => ({
      levelId,
      score,
      won,
      hits: 0,
      throws: 0,
      misses: 0,
      bestCombo: 0,
      hitsByType: { common: 0, swimmer: 0, fiddler: 0 },
      ammoLeft: 0,
      ...extra,
    });

    it('credits every point to the bank the first time, also after a loss', () => {
      const { profile, saved } = make();
      const lost = profile.recordRound(round(1, 60, false), NO_PROGRESS).credit;
      expect(lost).toEqual({ points: 60, reduced: false });
      const lostAgain = profile.recordRound(round(1, 30, false), NO_PROGRESS).credit;
      expect(lostAgain).toEqual({ points: 30, reduced: false }); // still not cleared
      expect(profile.data.points).toBe(90);
      expect(saved).toHaveLength(2);
    });

    it('credits the first win in full, and marks the level as cleared', () => {
      const { profile } = make();
      // The flow has already moved the frontier by the time the round-end listener runs.
      const { credit } = profile.recordRound(round(1, 120, true), {
        highestUnlockedLevel: 2,
        bestScoreByLevel: { 1: 120 },
      });
      expect(credit).toEqual({ points: 120, reduced: false });
      expect(profile.data.clearedLevels).toEqual([1]);
      expect(profile.data.points).toBe(120);
    });

    it('credits half of any round on a level that was cleared before, win or lose', () => {
      const { profile } = make({ version: 2, clearedLevels: [1], highestUnlockedLevel: 2 });
      expect(profile.recordRound(round(1, 121, true), NO_PROGRESS).credit).toEqual({
        points: 60,
        reduced: true,
      });
      expect(profile.recordRound(round(1, 40, false), NO_PROGRESS).credit).toEqual({
        points: 20,
        reduced: true,
      });
      expect(profile.data.points).toBe(80);
      expect(profile.data.clearedLevels).toEqual([1]);
    });

    it('treats another level on its own: only the cleared one is reduced', () => {
      const { profile } = make({ version: 2, clearedLevels: [1], highestUnlockedLevel: 2 });
      expect(profile.recordRound(round(2, 50, false), NO_PROGRESS).credit.reduced).toBe(false);
    });

    it('winning the last level, which never moves the frontier, still clears it', () => {
      const { profile } = make({ version: 2, highestUnlockedLevel: 3 });
      profile.recordRound(round(3, 150, true), { highestUnlockedLevel: 3, bestScoreByLevel: {} });
      expect(profile.data.clearedLevels).toEqual([3]);
      expect(profile.recordRound(round(3, 100, true), NO_PROGRESS).credit.points).toBe(50);
    });

    it('a version 1 save that had won level 1 already pays the reduced rate on it', () => {
      const { profile } = make({
        version: 1,
        highestUnlockedLevel: 2,
        bestScoreByLevel: { 1: 130 },
      });
      expect(profile.recordRound(round(1, 100, true), NO_PROGRESS).credit.points).toBe(50);
    });

    it('keeps the full score as the record: only the bank is reduced', () => {
      const { profile } = make({ version: 2, clearedLevels: [1] });
      profile.recordRound(round(1, 200, true), {
        highestUnlockedLevel: 1,
        bestScoreByLevel: { 1: 200 },
      });
      expect(profile.data.bestScoreByLevel).toEqual({ 1: 200 });
      expect(profile.data.points).toBe(100);
    });

    it('only moves campaign progress forward', () => {
      const { profile } = make({
        version: 2,
        highestUnlockedLevel: 3,
        bestScoreByLevel: { 1: 200 },
      });
      profile.recordRound(round(1, 10, false), {
        highestUnlockedLevel: 1,
        bestScoreByLevel: { 1: 50, 2: 70 },
      });
      expect(profile.data.highestUnlockedLevel).toBe(3);
      expect(profile.data.bestScoreByLevel).toEqual({ 1: 200, 2: 70 });
    });

    it('never credits a negative or fractional score', () => {
      const { profile } = make();
      profile.recordRound(round(1, -50, false), NO_PROGRESS);
      profile.recordRound(round(1, 10.9, false), NO_PROGRESS);
      expect(profile.data.points).toBe(10);
    });
  });

  describe('achievements (D36)', () => {
    const play = (
      levelId: number,
      won: boolean,
      extra: Partial<RoundRecord> = {},
    ): RoundRecord => ({
      levelId,
      score: 50,
      won,
      hits: 5,
      throws: 8,
      misses: 3,
      bestCombo: 2,
      hitsByType: { common: 5, swimmer: 0, fiddler: 0 },
      ammoLeft: 1,
      ...extra,
    });

    it('adds the round to the lifetime counters', () => {
      const { profile } = make();
      profile.recordRound(play(1, true, { score: 80, bestCombo: 3 }), NO_PROGRESS);
      profile.recordRound(
        play(1, false, {
          score: 40,
          bestCombo: 2,
          hits: 2,
          throws: 4,
          hitsByType: { common: 0, swimmer: 1, fiddler: 1 },
        }),
        NO_PROGRESS,
      );
      expect(profile.data.stats).toEqual({
        rounds: 2,
        wins: 1,
        throws: 12,
        hits: 7,
        bestCombo: 3,
        flawlessWins: 0,
        bestAmmoLeftOnWin: 1,
        totalPoints: 120,
        hitsByType: { common: 5, swimmer: 1, fiddler: 1 },
      });
    });

    it('counts the full score as total points, not what the replay rule sent to the bank', () => {
      const { profile } = make({ version: 2, clearedLevels: [1] });
      profile.recordRound(play(1, true, { score: 200 }), NO_PROGRESS);
      expect(profile.data.points).toBe(100);
      expect(profile.data.stats.totalPoints).toBe(200);
    });

    it('keeps counters whole and never lets a bad number lower them', () => {
      const { profile } = make();
      profile.recordRound(play(1, false, { score: -50, hits: -3, throws: 2.9 }), NO_PROGRESS);
      expect(profile.data.stats).toMatchObject({ totalPoints: 0, hits: 0, throws: 2 });
    });

    it('earns an achievement, pays its coins and tells which one', () => {
      const { profile } = make();
      const { unlocked } = profile.recordRound(play(1, false, { bestCombo: 1 }), NO_PROGRESS);
      expect(unlocked).toEqual([{ id: 'first-hit', coins: 5, items: [] }]);
      expect(profile.data.coins).toBe(5);
      expect(profile.data.achievements).toEqual(['first-hit']);
    });

    it('earns several at once, in catalog order, and pays all of them', () => {
      const { profile } = make();
      const { unlocked } = profile.recordRound(play(1, false, { bestCombo: 4 }), NO_PROGRESS);
      expect(unlocked.map((unlock) => unlock.id)).toEqual(['first-hit', 'combo-4']);
      expect(profile.data.coins).toBe(15);
    });

    it('pays only once: playing on never earns the same achievement again', () => {
      const { profile } = make();
      profile.recordRound(play(1, false), NO_PROGRESS);
      const again = profile.recordRound(play(1, false), NO_PROGRESS);
      expect(again.unlocked).toEqual([]);
      expect(profile.data.coins).toBe(5);
    });

    it('saves once per round, with the round, the coins and the achievements together', () => {
      const { profile, saved } = make();
      profile.recordRound(play(1, false), NO_PROGRESS);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ coins: 5, achievements: ['first-hit'] });
      expect(saved[0]?.stats.rounds).toBe(1);
    });

    it('a win without a missed throw unlocks the exclusive skin and it is owned at once', () => {
      const { profile } = make();
      const { unlocked } = profile.recordRound(
        play(1, true, { misses: 0, hits: 6, throws: 6 }),
        NO_PROGRESS,
      );
      expect(unlocked.find((unlock) => unlock.id === 'flawless-win')).toEqual({
        id: 'flawless-win',
        coins: 0,
        items: ['ember'],
      });
      expect(profile.data.ownedSkins).toContain('ember');
      expect(profile.equip('ember')).toBeUndefined();
    });

    it('a flawless round that was lost does not count', () => {
      const { profile } = make();
      profile.recordRound(play(1, false, { misses: 0 }), NO_PROGRESS);
      expect(profile.data.stats.flawlessWins).toBe(0);
      expect(profile.data.ownedSkins).not.toContain('ember');
    });

    it('an item that is earned can never be bought', () => {
      const { profile } = make({ version: 2, coins: 9999 });
      expect(profile.buy('ember')).toBe('not-for-sale');
      expect(profile.data.ownedSkins).not.toContain('ember');
    });

    it('does not own the skin of an achievement that was not earned', () => {
      const { profile } = make();
      profile.recordRound(play(1, true), NO_PROGRESS);
      expect(profile.data.ownedSkins).toEqual(['classic']);
    });

    it('earns a biome by winning its last level, also with levels won in older saves', () => {
      const { profile } = make({ version: 2, clearedLevels: [1] });
      expect(profile.recordRound(play(2, true, { hits: 0 }), NO_PROGRESS).unlocked).toEqual([
        { id: 'clear-beach', coins: 12, items: [] },
      ]);
    });

    it('does not earn a biome while one of its levels is still to win', () => {
      const { profile } = make();
      const { unlocked } = profile.recordRound(play(1, true, { hits: 0 }), NO_PROGRESS);
      expect(unlocked).toEqual([]);
    });

    it('gives a save that had won a whole biome before M8 the achievement on its next round', () => {
      const { profile } = make({ version: 2, clearedLevels: [1, 2] });
      const { unlocked } = profile.recordRound(play(2, true, { hits: 0 }), NO_PROGRESS);
      expect(unlocked.map((unlock) => unlock.id)).toEqual(['clear-beach']); // the save never had it
      expect(profile.recordRound(play(2, true, { hits: 0 }), NO_PROGRESS).unlocked).toEqual([]);
    });

    it('gives the achievements screen the progress of every one, in order', () => {
      const { profile } = make();
      profile.recordRound(play(1, true, { bestCombo: 3, hits: 2 }), NO_PROGRESS);
      expect(profile.achievementProgress()).toEqual([
        { id: 'first-hit', earned: true, progress: { current: 1, goal: 1 } },
        { id: 'combo-4', earned: false, progress: { current: 3, goal: 4 } },
        { id: 'flawless-win', earned: false, progress: { current: 0, goal: 1 } },
        { id: 'clear-beach', earned: false, progress: { current: 1, goal: 2 } },
      ]);
    });

    it('tells the listeners once, after everything was applied', () => {
      const { profile } = make();
      const seen: number[] = [];
      profile.onChange(() => seen.push(profile.data.coins));
      profile.recordRound(play(1, false, { bestCombo: 4 }), NO_PROGRESS);
      expect(seen).toEqual([15]);
    });
  });

  it('feeds the campaign with the stored progress', () => {
    const { profile } = make({ version: 2, highestUnlockedLevel: 2, bestScoreByLevel: { 1: 9 } });
    expect(profile.progress).toEqual({ highestUnlockedLevel: 2, bestScoreByLevel: { 1: 9 } });
  });

  describe('convertAll', () => {
    it('turns the bank into coins at the rate, keeping the remainder as points', () => {
      const { profile, saved } = make({ version: 2, points: 103, coins: 2 });
      expect(profile.convertibleCoins).toBe(20);
      expect(profile.convertAll()).toBe(20);
      expect(profile.data).toMatchObject({ points: 3, coins: 22 });
      expect(saved).toHaveLength(1);
    });

    it('does nothing, and stores nothing, below one coin', () => {
      const { profile, saved } = make({ version: 2, points: 4 });
      expect(profile.convertAll()).toBe(0);
      expect(profile.data.points).toBe(4);
      expect(saved).toEqual([]);
    });

    it('has nothing to convert the second time', () => {
      const { profile } = make({ version: 2, points: 50 });
      expect(profile.convertAll()).toBe(10);
      expect(profile.convertAll()).toBe(0);
      expect(profile.data).toMatchObject({ points: 0, coins: 10 });
    });
  });

  it('buys and equips a skin with coins, storing each step; points are never spent directly', () => {
    const { profile, saved } = make({ version: 2, points: 1000, coins: 100 });
    expect(profile.buy('ocean')).toBeUndefined();
    expect(profile.data).toMatchObject({
      points: 1000,
      coins: 60,
      ownedSkins: ['classic', 'ocean'],
    });
    expect(profile.equip('ocean')).toBeUndefined();
    expect(profile.data.equippedSkin).toBe('ocean');
    expect(saved).toHaveLength(2);
  });

  it('cannot buy with points alone: they must be converted first', () => {
    const { profile, saved } = make({ version: 2, points: 5000, coins: 0 });
    expect(profile.buy('ocean')).toBe('insufficient-coins');
    expect(saved).toEqual([]);
  });

  it('reports why a purchase or equip failed and stores nothing', () => {
    const { profile, saved } = make({ version: 2, coins: 10 });
    expect(profile.buy('ocean')).toBe('insufficient-coins');
    expect(profile.buy('nope')).toBe('unknown-item');
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
    expect(profile.data.settings).toEqual({
      muted: true,
      music: true,
      volume: 1,
      locale: 'pt-BR',
    });
    expect(saved).toHaveLength(2);
  });

  it('stores the music switch and the volume, clamping the volume to 0..1', () => {
    const { profile, saved } = make();
    profile.setMusic(false);
    profile.setMusic(false);
    profile.setVolume(0.4);
    profile.setVolume(0.4);
    profile.setVolume(7);
    profile.setVolume(-1);
    profile.setVolume(Number.NaN);
    expect(profile.data.settings).toMatchObject({ music: false, volume: 1 });
    expect(saved.map((data) => data.settings.volume)).toEqual([1, 0.4, 1, 0, 1]);
  });

  it('tells listeners about every change, until they unsubscribe', () => {
    const { profile } = make({ version: 2, coins: 100 });
    const listener = vi.fn();
    const off = profile.onChange(listener);
    profile.buy('ocean');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    profile.equip('ocean');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('saving bursts of changes', () => {
    /** A timer the test drives by hand. */
    function manualTimer() {
      const waiting: { run: () => void; ms: number; cancelled: boolean }[] = [];
      const later: Later = (run, ms) => {
        const entry = { run, ms, cancelled: false };
        waiting.push(entry);
        return () => {
          entry.cancelled = true;
        };
      };
      const fire = () => {
        for (const entry of waiting.splice(0)) if (!entry.cancelled) entry.run();
      };
      return { later, fire, waiting };
    }
    const makeWithTimer = (stored?: unknown) => {
      const { repo, saved } = memoryRepo(stored);
      const timer = manualTimer();
      return {
        profile: new Profile(repo, RULES, CATALOG, ECONOMY, ACHIEVEMENTS, timer.later),
        saved,
        timer,
      };
    };

    it('keeps the volume in memory at once but saves it once, after the dragging stops', () => {
      const { profile, saved, timer } = makeWithTimer();
      const heard = vi.fn();
      profile.onChange(heard);
      for (const volume of [0.9, 0.8, 0.7, 0.6, 0.5]) profile.setVolume(volume);
      expect(profile.data.settings.volume).toBe(0.5);
      expect(heard).toHaveBeenCalledTimes(5); // the UI and the audio follow every step
      expect(saved).toHaveLength(0);
      timer.fire();
      expect(saved).toHaveLength(1);
      expect(saved[0]?.settings.volume).toBe(0.5);
    });

    it('waits the agreed time and only one save is ever pending', () => {
      const { profile, timer } = makeWithTimer();
      profile.setVolume(0.9);
      profile.setVolume(0.8);
      const live = timer.waiting.filter((entry) => !entry.cancelled);
      expect(live).toHaveLength(1);
      expect(live[0]?.ms).toBe(SAVE_DELAY_MS);
    });

    it('saves a typed name later, and the final name at once when it is committed', () => {
      const { profile, saved, timer } = makeWithTimer();
      profile.typePlayerName('M');
      profile.typePlayerName('Ma');
      profile.typePlayerName('Mar');
      expect(profile.data.playerName).toBe('Mar');
      expect(saved).toHaveLength(0);
      expect(profile.setPlayerName('Maria')).toBe('Maria');
      expect(saved).toHaveLength(1);
      expect(saved[0]?.playerName).toBe('Maria');
      timer.fire();
      expect(saved).toHaveLength(1); // the timer was cancelled by the immediate save
    });

    it('committing a name that was already typed saves it now', () => {
      const { profile, saved, timer } = makeWithTimer();
      profile.typePlayerName('Maria');
      expect(saved).toHaveLength(0);
      expect(profile.setPlayerName('Maria')).toBe('Maria');
      expect(saved).toHaveLength(1);
      timer.fire();
      expect(saved).toHaveLength(1);
    });

    it('an immediate change also saves what was waiting', () => {
      const { profile, saved, timer } = makeWithTimer({ version: 2, coins: 100 });
      profile.setVolume(0.3);
      profile.buy('ocean');
      expect(saved).toHaveLength(1);
      expect(saved[0]?.settings.volume).toBe(0.3);
      expect(saved[0]?.coins).toBe(60);
      timer.fire();
      expect(saved).toHaveLength(1);
    });

    it('flush() writes the waiting change right away, and only when there is one', () => {
      const { profile, saved, timer } = makeWithTimer();
      profile.flush();
      expect(saved).toHaveLength(0);
      profile.setVolume(0.2);
      profile.flush();
      expect(saved).toHaveLength(1);
      timer.fire();
      profile.flush();
      expect(saved).toHaveLength(1);
    });

    it('saves at once when there is no timer (tests, simple hosts)', () => {
      const { profile, saved } = make();
      profile.setVolume(0.2);
      profile.typePlayerName('Ana');
      expect(saved).toHaveLength(2);
    });
  });
});
