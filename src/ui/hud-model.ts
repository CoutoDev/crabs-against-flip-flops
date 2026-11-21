import { comboMultiplier } from '../domain/rules/scoring';
import type { RoundState } from '../domain/rules/round';
import type { Translator } from './i18n/translator';

export interface HudModel {
  readonly level: string;
  readonly score: string;
  readonly goal: string;
  readonly ammo: string;
  readonly combo: string;
  /** 0..1 progress towards the target score, for the progress bar. */
  readonly progress: number;
  readonly ammoLow: boolean;
}

export const LOW_AMMO_THRESHOLD = 3;
const NO_COMBO = '–';

/** Turns the round into the strings the HUD shows. Pure: the DOM layer only copies them. */
export function buildHud(state: RoundState, levelNumber: number, translator: Translator): HudModel {
  const { level } = state.config;
  const nextMultiplier = comboMultiplier(state.combo + 1, level.scoring);
  return {
    level: translator.t('hud.level', { level: levelNumber }),
    score: translator.formatNumber(state.score),
    goal: translator.formatNumber(level.targetScore),
    ammo: translator.formatNumber(state.ammo),
    // Streak so far and the multiplier the NEXT hit will earn, so the player can plan.
    combo:
      state.combo === 0 ? NO_COMBO : `${translator.formatNumber(state.combo)} · x${nextMultiplier}`,
    progress: Math.min(1, state.score / level.targetScore),
    ammoLow: state.ammo <= LOW_AMMO_THRESHOLD,
  };
}
