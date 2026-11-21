/**
 * Plural message. `one`/`other` follow Intl.PluralRules; `zero` is an optional override for
 * count === 0 (needed in pt-BR, where CLDR treats 0 as "one": "0 ponto" reads wrong in a score).
 */
export interface PluralMessage {
  readonly zero?: string;
  readonly one: string;
  readonly other: string;
}

export type Message = string | PluralMessage;

/**
 * English is the source catalog: every other locale must provide exactly these keys
 * (enforced by the compiler through `MessageKey`).
 */
export const en = {
  'game.title': 'Crabs Against Flip Flops',
  'game.tagline': 'Throw flip flops at the crabs!',
  'menu.play': 'Play',
  'score.points': { one: '{count} point', other: '{count} points' },
  'settings.language': 'Language',
  'language.pt-BR': 'Português (Brasil)',
  'language.en': 'English',
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
