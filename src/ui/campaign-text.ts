import type { CrabType } from '../domain/entities/crab';
import type { Biome } from '../domain/entities/level';
import type { MessageKey } from './i18n/messages/en';
import type { Translator } from './i18n/translator';

/**
 * Level names are catalog keys by level id (`levels.<id>.name`, ADR section 6). The key is built
 * at run time, so a test walks every level of the campaign to prove each id has its name.
 */
export const levelNameKey = (levelId: number): MessageKey => `levels.${levelId}.name` as MessageKey;

export const levelName = (translator: Translator, levelId: number): string =>
  translator.t(levelNameKey(levelId));

export const canvasLabelKey = (biome: Biome): MessageKey => `canvas.label.${biome}`;

export const crabNameKey = (type: CrabType): MessageKey => `crab.${type}`;
