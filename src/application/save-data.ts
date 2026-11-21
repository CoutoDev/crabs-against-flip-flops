import { isLocale, type Locale } from './locale';
import { sanitizePlayerName } from './player-name';

/**
 * What is persisted (ADR section 5). Reading is always defensive: the storage is user-editable, so
 * every field is validated and falls back to its default instead of breaking the game.
 */
export interface SaveDataV1 {
  readonly version: 1;
  /** Empty until the player picks one. */
  readonly playerName: string;
  /** Points available to spend in the shop. */
  readonly balance: number;
  /** Id of the furthest level the player may play. */
  readonly highestUnlockedLevel: number;
  readonly bestScoreByLevel: Readonly<Record<number, number>>;
  readonly ownedSkins: readonly string[];
  readonly equippedSkin: string;
  readonly settings: {
    readonly muted: boolean;
    /** 0..1. Stored for the volume control that arrives with the audio polish (M5). */
    readonly volume: number;
    /** `null` until the player chooses: the browser language is used meanwhile. */
    readonly locale: Locale | null;
  };
}

/** What the save has to agree with: the levels and skins that exist in this build. */
export interface SaveRules {
  readonly levelIds: readonly number[];
  readonly skinIds: readonly string[];
  /** Free skin everyone owns and wears at first. */
  readonly defaultSkin: string;
}

const MAX_NUMBER = 1_000_000_000;

export function defaultSave(rules: SaveRules): SaveDataV1 {
  return {
    version: 1,
    playerName: '',
    balance: 0,
    highestUnlockedLevel: rules.levelIds[0] ?? 1,
    bestScoreByLevel: {},
    ownedSkins: [rules.defaultSkin],
    equippedSkin: rules.defaultSkin,
    settings: { muted: false, volume: 1, locale: null },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_NUMBER;

/**
 * Turns whatever was stored into a valid save. An unknown version or something that is not an
 * object gives the default save; otherwise each field is repaired on its own, so one bad field
 * does not cost the player the rest of their progress.
 */
export function parseSave(raw: unknown, rules: SaveRules): SaveDataV1 {
  const fallback = defaultSave(rules);
  if (!isRecord(raw) || raw['version'] !== 1) return fallback;

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

  const ownedRaw = raw['ownedSkins'];
  const known = new Set(rules.skinIds);
  const owned = new Set<string>([rules.defaultSkin]);
  if (Array.isArray(ownedRaw)) {
    for (const id of ownedRaw) if (typeof id === 'string' && known.has(id)) owned.add(id);
  }
  const equippedRaw = raw['equippedSkin'];
  const equippedSkin =
    typeof equippedRaw === 'string' && owned.has(equippedRaw) ? equippedRaw : rules.defaultSkin;

  const settingsRaw = isRecord(raw['settings']) ? raw['settings'] : {};
  const volumeRaw = settingsRaw['volume'];
  const localeRaw = settingsRaw['locale'];

  return {
    version: 1,
    playerName: typeof raw['playerName'] === 'string' ? sanitizePlayerName(raw['playerName']) : '',
    balance: isCount(raw['balance']) ? raw['balance'] : 0,
    highestUnlockedLevel,
    bestScoreByLevel,
    ownedSkins: [...owned],
    equippedSkin,
    settings: {
      muted: settingsRaw['muted'] === true,
      volume:
        typeof volumeRaw === 'number' && volumeRaw >= 0 && volumeRaw <= 1
          ? volumeRaw
          : fallback.settings.volume,
      locale: isLocale(localeRaw) ? localeRaw : null,
    },
  };
}
