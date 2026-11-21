import type { ProgressRepository } from '../../application/ports/progress-repository';
import type { SaveDataV1 } from '../../application/save-data';

export const SAVE_KEY = 'crabs-against-flip-flops:save';

/** The part of `Storage` this adapter uses, so tests can pass a fake. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Keeps the save as JSON in `localStorage`. Browsers can refuse any access (private mode,
 * blocked storage, full quota), so nothing here is allowed to throw: the game then simply runs
 * without remembering.
 */
export class LocalStorageProgressRepository implements ProgressRepository {
  constructor(
    private readonly storage: () => KeyValueStorage | undefined,
    private readonly key: string = SAVE_KEY,
  ) {}

  load(): unknown {
    try {
      const text = this.storage()?.getItem(this.key);
      return text === null || text === undefined ? undefined : (JSON.parse(text) as unknown);
    } catch {
      return undefined; // blocked storage or corrupted JSON: start fresh
    }
  }

  save(data: SaveDataV1): void {
    try {
      this.storage()?.setItem(this.key, JSON.stringify(data));
    } catch {
      // Full or blocked: keep playing, the progress just will not survive a reload.
    }
  }
}

/** `window.localStorage` itself can throw on access (e.g. blocked cookies), hence the guard. */
export function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
