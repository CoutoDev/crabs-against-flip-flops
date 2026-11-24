import { isLocale, type Locale } from './locale';
import { sanitizePlayerName } from './player-name';

/**
 * What is persisted (ADR section 5). Reading is always defensive: the storage is user-editable, so
 * every field is validated and falls back to its default instead of breaking the game.
 */
export interface SaveData {
  readonly version: 2;
  /** Empty until the player picks one. */
  readonly playerName: string;
  /** The point bank: what rounds earned and the player has not converted yet (D35). */
  readonly points: number;
  /** What the shop charges, got by converting points. */
  readonly coins: number;
  /** Id of the furthest level the player may play. */
  readonly highestUnlockedLevel: number;
  /** Levels won at least once: later rounds on them credit fewer points to the bank (anti-farm). */
  readonly clearedLevels: readonly number[];
  readonly bestScoreByLevel: Readonly<Record<number, number>>;
  readonly ownedSkins: readonly string[];
  readonly equippedSkin: string;
  readonly settings: {
    /** Silences everything (sound effects and music). */
    readonly muted: boolean;
    /** Background music on or off; effects stay. */
    readonly music: boolean;
    /** Master volume, 0..1. */
    readonly volume: number;
    /** `null` until the player chooses: the browser language is used meanwhile. */
    readonly locale: Locale | null;
  };
}

/** What the save has to agree with: the levels and skins that exist in this build. */
export interface SaveRules {
  readonly levelIds: readonly number[];
  /** Score that wins each level; used to tell which levels a version 1 save had already won. */
  readonly goalByLevel: Readonly<Record<number, number>>;
  readonly skinIds: readonly string[];
  /** Free skin everyone owns and wears at first. */
  readonly defaultSkin: string;
}

const MAX_NUMBER = 1_000_000_000;

export function defaultSave(rules: SaveRules): SaveData {
  return {
    version: 2,
    playerName: '',
    points: 0,
    coins: 0,
    highestUnlockedLevel: rules.levelIds[0] ?? 1,
    clearedLevels: [],
    bestScoreByLevel: {},
    ownedSkins: [rules.defaultSkin],
    equippedSkin: rules.defaultSkin,
    settings: { muted: false, music: true, volume: 1, locale: null },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_NUMBER;

/**
 * Turns whatever was stored into a valid save of the current version. An unknown version or
 * something that is not an object gives the default save; otherwise each field is repaired on its
 * own, so one bad field does not cost the player the rest of their progress.
 *
 * A version 1 save is migrated without losing anything: its single `balance` becomes the point
 * bank, coins start at zero, and the levels it had won are worked out from the campaign progress.
 */
export function parseSave(raw: unknown, rules: SaveRules): SaveData {
  const fallback = defaultSave(rules);
  if (!isRecord(raw) || (raw['version'] !== 1 && raw['version'] !== 2)) return fallback;
  const migrating = raw['version'] === 1;

  const highestRaw = raw['highestUnlockedLevel'];
  const highestUnlockedLevel =
    typeof highestRaw === 'number' && rules.levelIds.includes(highestRaw)
      ? highestRaw
      : fallback.highestUnlockedLevel;

  const bestScoreByLevel: Record<number, number> = {};
  const bestRaw = raw['bestScoreByLevel'];
  if (isRecord(bestRaw)) {
    for (const [key, value] of Object.entries(bestRaw)) {
      const id = Number(key);
      if (rules.levelIds.includes(id) && isCount(value) && value > 0) bestScoreByLevel[id] = value;
    }
  }

  // A win moves the frontier up, or (on the last level) scores at least the goal: both are kept.
  const cleared = new Set<number>();
  if (migrating) {
    rules.levelIds.forEach((id, index) => {
      const goal = rules.goalByLevel[id];
      const best = bestScoreByLevel[id] ?? 0;
      if (index < rules.levelIds.indexOf(highestUnlockedLevel)) cleared.add(id);
      else if (goal !== undefined && best >= goal) cleared.add(id);
    });
  } else if (Array.isArray(raw['clearedLevels'])) {
    for (const id of raw['clearedLevels']) {
      if (typeof id === 'number' && rules.levelIds.includes(id)) cleared.add(id);
    }
  }

  const ownedRaw = raw['ownedSkins'];
  const known = new Set(rules.skinIds);
  const owned = new Set<string>([rules.defaultSkin]);
  if (Array.isArray(ownedRaw)) {
    for (const id of ownedRaw) if (typeof id === 'string' && known.has(id)) owned.add(id);
  }
  const equippedRaw = raw['equippedSkin'];
  const equippedSkin =
    typeof equippedRaw === 'string' && owned.has(equippedRaw) ? equippedRaw : rules.defaultSkin;

  const bankRaw = migrating ? raw['balance'] : raw['points'];
  const settingsRaw = isRecord(raw['settings']) ? raw['settings'] : {};
  const volumeRaw = settingsRaw['volume'];
  const localeRaw = settingsRaw['locale'];

  return {
    version: 2,
    playerName: typeof raw['playerName'] === 'string' ? sanitizePlayerName(raw['playerName']) : '',
    points: isCount(bankRaw) ? bankRaw : 0,
    coins: !migrating && isCount(raw['coins']) ? raw['coins'] : 0,
    highestUnlockedLevel,
    clearedLevels: rules.levelIds.filter((id) => cleared.has(id)),
    bestScoreByLevel,
    ownedSkins: [...owned],
    equippedSkin,
    settings: {
      muted: settingsRaw['muted'] === true,
      music: settingsRaw['music'] !== false,
      volume:
        typeof volumeRaw === 'number' && volumeRaw >= 0 && volumeRaw <= 1
          ? volumeRaw
          : fallback.settings.volume,
      locale: isLocale(localeRaw) ? localeRaw : null,
    },
  };
}
