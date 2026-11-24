import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../application/save-data';
import {
  LocalStorageProgressRepository,
  SAVE_KEY,
  type KeyValueStorage,
} from './local-storage-progress-repository';

const save = defaultSave({
  levelIds: [1],
  goalByLevel: { 1: 100 },
  skinIds: ['classic'],
  achievementIds: [],
  defaultSkin: 'classic',
});

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
  return { storage, items };
}

describe('LocalStorageProgressRepository', () => {
  it('returns undefined when nothing is stored', () => {
    const { storage } = fakeStorage();
    expect(new LocalStorageProgressRepository(() => storage).load()).toBeUndefined();
  });

  it('stores the save as JSON and reads it back', () => {
    const { storage, items } = fakeStorage();
    const repo = new LocalStorageProgressRepository(() => storage);
    repo.save({ ...save, points: 40 });
    expect(JSON.parse(items.get(SAVE_KEY) ?? 'null')).toMatchObject({ version: 2, points: 40 });
    expect(repo.load()).toMatchObject({ points: 40 });
  });

  it('returns undefined for corrupted JSON instead of throwing', () => {
    const { storage } = fakeStorage({ [SAVE_KEY]: '{not json' });
    expect(new LocalStorageProgressRepository(() => storage).load()).toBeUndefined();
  });

  it('survives a storage that throws on read and on write', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const repo = new LocalStorageProgressRepository(() => broken);
    expect(repo.load()).toBeUndefined();
    expect(() => repo.save(save)).not.toThrow();
  });

  it('works without any storage at all', () => {
    const repo = new LocalStorageProgressRepository(() => undefined);
    expect(repo.load()).toBeUndefined();
    expect(() => repo.save(save)).not.toThrow();
  });

  it('uses the key it was given, so tests and builds do not share a save', () => {
    const { storage, items } = fakeStorage();
    new LocalStorageProgressRepository(() => storage, 'other').save(save);
    expect([...items.keys()]).toEqual(['other']);
  });
});
