import { describe, expect, it } from 'vitest';
import { CRAB_TYPE_IDS } from '../domain/entities/crab';
import { validateLevel } from '../domain/rules/level-validation';
import { CRAB_TYPES } from './crab-types';
import { LEVELS } from './levels';

describe('crab types data', () => {
  it('defines every crab type exactly once', () => {
    expect(Object.keys(CRAB_TYPES).sort()).toEqual([...CRAB_TYPE_IDS].sort());
  });

  it.each(CRAB_TYPE_IDS)('%s has positive points and hit radius', (id) => {
    expect(CRAB_TYPES[id].points).toBeGreaterThan(0);
    expect(CRAB_TYPES[id].hitRadiusPx).toBeGreaterThan(0);
  });
});

describe('levels data', () => {
  it('has sequential ids starting at 1', () => {
    expect(LEVELS.map((level) => level.id)).toEqual(LEVELS.map((_, index) => index + 1));
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))('level %i is valid', (_id, level) => {
    expect(validateLevel(level, CRAB_TYPES)).toEqual([]);
  });
});
