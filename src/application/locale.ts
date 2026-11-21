/** Locales supported by the game. The first one listed is also the "native" one of the author. */
export const LOCALES = ['pt-BR', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Used when the browser reports no supported language. */
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
