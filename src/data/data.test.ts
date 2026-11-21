import { describe, expect, it } from 'vitest';
import { SHORELINE_Y_PX } from '../domain/constants';
import { CRAB_TYPE_IDS } from '../domain/entities/crab';
import { validateLevel } from '../domain/rules/level-validation';
import { CRAB_TYPES } from './crab-types';
import { LEVELS } from './levels';
import { DEFAULT_SKIN_ID, SKINS } from './skins';

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

  it('walks through the biomes in order: beach, rocks, mangrove, night', () => {
    const order = ['beach', 'rocks', 'mangrove', 'night'] as const;
    const ranks = LEVELS.map((level) => order.indexOf(level.biome));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(LEVELS.map((level) => level.biome))).toEqual(new Set(order));
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))(
    'level %i keeps its crabs on the ground, below the shoreline',
    (_id, level) => {
      expect(level.spawn.laneY.min).toBeGreaterThan(SHORELINE_Y_PX);
    },
  );

  it('introduces the crab types gradually: swimmers before fiddlers, none on level 1 but commons', () => {
    const firstLevelWith = (type: string) =>
      LEVELS.findIndex((level) => level.crabs.some((entry) => entry.type === type));
    expect(LEVELS[0]?.crabs.map((entry) => entry.type)).toEqual(['common']);
    expect(firstLevelWith('swimmer')).toBeGreaterThan(0);
    expect(firstLevelWith('fiddler')).toBeGreaterThan(firstLevelWith('swimmer'));
  });

  it('asks for more points as the campaign goes on', () => {
    const targets = LEVELS.map((level) => level.targetScore);
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
  });
});

describe('skins data', () => {
  it('has unique ids, and the default skin is free and comes first', () => {
    const ids = SKINS.map((skin) => skin.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SKINS[0]).toEqual({ id: DEFAULT_SKIN_ID, price: 0 });
  });

  it('prices are whole numbers, ascending, and only the default is free', () => {
    const prices = SKINS.map((skin) => skin.price);
    expect(prices.every((price) => Number.isInteger(price) && price >= 0)).toBe(true);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices.filter((price) => price === 0)).toHaveLength(1);
  });
});
