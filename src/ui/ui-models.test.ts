import { describe, expect, it } from 'vitest';
import { LOCALES } from '../application/locale';
import { LEVELS } from '../data/levels';
import type { DomainEvent } from '../domain/events';
import { createRound, type RoundState } from '../domain/rules/round';
import { makeLevel, TEST_CRAB_SPECS } from '../domain/test-support';
import { announcementFor } from './announce';
import { CRAB_TYPE_IDS } from '../domain/entities/crab';
import { SKINS } from '../data/skins';
import { skinName } from './shop-view';
import { canvasLabelKey, crabNameKey, levelName } from './campaign-text';
import { buildHud, LOW_AMMO_THRESHOLD } from './hud-model';
import { createTranslator } from './i18n/translator';

const state = (overrides: Partial<RoundState> = {}): RoundState => ({
  ...createRound(
    { level: makeLevel({ ammo: 16, targetScore: 100 }), crabSpecs: TEST_CRAB_SPECS },
    1,
  ),
  ...overrides,
});

describe('buildHud', () => {
  const en = createTranslator('en');

  it('formats the numbers for the locale', () => {
    const hud = buildHud(state({ score: 1500 }), 3, createTranslator('pt-BR'));
    expect(hud.score).toBe('1.500');
    expect(hud.level).toBe('Nível 3');
    expect(buildHud(state({ score: 1500 }), 3, en).score).toBe('1,500');
  });

  it('shows the name of the level under its number', () => {
    expect(buildHud(state(), 1, en).levelName).toBe('Sandy Shore');
    expect(buildHud(state(), 1, createTranslator('pt-BR')).levelName).toBe('Praia Calma');
  });

  it('shows ammo and goal', () => {
    const hud = buildHud(state({ ammo: 7 }), 1, en);
    expect(hud.ammo).toBe('7');
    expect(hud.goal).toBe('100');
  });

  it('shows no combo until the first hit', () => {
    expect(buildHud(state({ combo: 0 }), 1, en).combo).toBe('–');
  });

  it('shows the streak and the multiplier the NEXT hit will earn (step 3, max 4)', () => {
    // Hits 1-3 are x1, 4-6 are x2, 7-9 are x3, 10+ are x4.
    const combo = (n: number) => buildHud(state({ combo: n }), 1, en).combo;
    expect(combo(1)).toBe('1 · x1'); // next is the 2nd hit
    expect(combo(2)).toBe('2 · x1'); // next is the 3rd hit, still x1
    expect(combo(3)).toBe('3 · x2'); // next is the 4th hit
    expect(combo(6)).toBe('6 · x3'); // next is the 7th hit
    expect(combo(9)).toBe('9 · x4'); // next is the 10th hit
  });

  it('caps the multiplier', () => {
    expect(buildHud(state({ combo: 50 }), 1, en).combo).toBe('50 · x4');
  });

  it('reports progress towards the goal, never above 100%', () => {
    expect(buildHud(state({ score: 0 }), 1, en).progress).toBe(0);
    expect(buildHud(state({ score: 50 }), 1, en).progress).toBe(0.5);
    expect(buildHud(state({ score: 130 }), 1, en).progress).toBe(1);
  });

  it('flags low ammo from the threshold down', () => {
    expect(buildHud(state({ ammo: LOW_AMMO_THRESHOLD + 1 }), 1, en).ammoLow).toBe(false);
    expect(buildHud(state({ ammo: LOW_AMMO_THRESHOLD }), 1, en).ammoLow).toBe(true);
    expect(buildHud(state({ ammo: 0 }), 1, en).ammoLow).toBe(true);
  });
});

describe('announcementFor', () => {
  const origin = { x: 0, y: 0 };

  it('announces score milestones in both languages', () => {
    const milestone: DomainEvent = { type: 'ScoreMilestone', milestone: 50, score: 52 };
    expect(announcementFor(milestone, createTranslator('en'))).toBe('Milestone: 50');
    expect(announcementFor(milestone, createTranslator('pt-BR'))).toBe('Marco: 50');
  });

  it('stays quiet for everything else, hits included (it would talk over the player)', () => {
    const en = createTranslator('en');
    const quiet: DomainEvent[] = [
      {
        type: 'CrabHit',
        crabId: 1,
        crabType: 'common',
        position: origin,
        basePoints: 10,
        multiplier: 2,
        points: 20,
        combo: 4,
        score: 20,
      },
      { type: 'SlipperMissed', flightId: 1, position: origin, lostCombo: 0 },
      { type: 'ThrowRejected', reason: 'no_ammo' },
      { type: 'ThrowRejected', reason: 'round_over' },
      { type: 'SlipperThrown', flightId: 1, target: origin, durationMs: 1 },
      { type: 'LevelCleared', score: 1, ammoLeft: 0 },
      { type: 'RoundLost', score: 1 },
    ];
    for (const event of quiet) expect(announcementFor(event, en), event.type).toBeUndefined();
  });
});

describe('shop text', () => {
  it.each(LOCALES)('%s names every skin of the catalog', (locale) => {
    const translator = createTranslator(locale);
    const names = SKINS.map((skin) => skinName(translator, skin.id));
    for (const [index, name] of names.entries()) {
      expect(name, SKINS[index]?.id).not.toMatch(/^skins\./);
    }
    expect(new Set(names).size).toBe(SKINS.length);
  });
});

describe('campaign text', () => {
  it.each(LOCALES)('%s has a name for every crab type', (locale) => {
    const translator = createTranslator(locale);
    const names = CRAB_TYPE_IDS.map((type) => translator.t(crabNameKey(type)));
    expect(new Set(names).size).toBe(CRAB_TYPE_IDS.length);
  });

  it.each(LOCALES)('%s names every level of the campaign', (locale) => {
    const translator = createTranslator(locale);
    for (const level of LEVELS) {
      expect(levelName(translator, level.id), `level ${level.id}`).not.toBe(
        `levels.${level.id}.name`,
      );
      expect(levelName(translator, level.id).length).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)('%s describes the field of every biome', (locale) => {
    const translator = createTranslator(locale);
    const labels = new Set(LEVELS.map((level) => translator.t(canvasLabelKey(level.biome))));
    expect(labels.size).toBe(new Set(LEVELS.map((level) => level.biome)).size);
  });
});
