import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from '../../application/consent';
import { CONSENT_KEY, LocalStorageConsentStore } from './local-storage-consent-store';

const record = { version: CONSENT_VERSION, analytics: true, decidedAt: 1 };

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => void (data[key] = value),
  };
}

describe('LocalStorageConsentStore', () => {
  it('round-trips a record', () => {
    const storage = memory();
    const store = new LocalStorageConsentStore(() => storage);
    store.save(record);
    expect(JSON.parse(storage.data[CONSENT_KEY] ?? 'null')).toEqual(record);
    expect(store.load()).toEqual(record);
  });

  it('reads nothing when there is nothing, the JSON is broken or the storage is blocked', () => {
    expect(new LocalStorageConsentStore(() => memory()).load()).toBeUndefined();
    expect(
      new LocalStorageConsentStore(() => memory({ [CONSENT_KEY]: '{ nope' })).load(),
    ).toBeUndefined();
    expect(new LocalStorageConsentStore(() => undefined).load()).toBeUndefined();
  });

  it('never throws when the storage refuses to write or to read', () => {
    const angry = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    const store = new LocalStorageConsentStore(() => angry);
    expect(() => store.save(record)).not.toThrow();
    expect(store.load()).toBeUndefined();
  });
});
