import type { SaveDataV1 } from '../save-data';

/**
 * Where the player's save lives (D4). Today it is the browser's `localStorage`; an API with
 * accounts can replace it without touching the game. Reading hands back whatever was stored
 * (untrusted); the application validates it with `parseSave`.
 */
export interface ProgressRepository {
  /** The stored value, or `undefined` when there is none or it cannot be read. Never throws. */
  load(): unknown;
  /** Best effort: a full or blocked storage must not break the game, so it never throws either. */
  save(data: SaveDataV1): void;
}
