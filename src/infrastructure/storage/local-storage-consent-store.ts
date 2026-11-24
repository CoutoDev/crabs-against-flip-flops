import type { ConsentRecord, ConsentStore } from '../../application/ports/consent-store';
import type { KeyValueStorage } from './local-storage-progress-repository';

export const CONSENT_KEY = 'crabs-against-flip-flops:consent';

/** Keeps the consent record as JSON in `localStorage`. Like the save, it never throws. */
export class LocalStorageConsentStore implements ConsentStore {
  constructor(
    private readonly storage: () => KeyValueStorage | undefined,
    private readonly key: string = CONSENT_KEY,
  ) {}

  load(): unknown {
    try {
      const text = this.storage()?.getItem(this.key);
      return text === null || text === undefined ? undefined : (JSON.parse(text) as unknown);
    } catch {
      return undefined; // blocked storage or corrupted JSON: ask again
    }
  }

  save(record: ConsentRecord): void {
    try {
      this.storage()?.setItem(this.key, JSON.stringify(record));
    } catch {
      // Blocked or full: the choice is kept for this visit only.
    }
  }
}
