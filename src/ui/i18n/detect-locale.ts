import { DEFAULT_LOCALE, type Locale } from '../../application/locale';

const PRIMARY_SUBTAG_TO_LOCALE: Readonly<Record<string, Locale>> = {
  pt: 'pt-BR', // pt-PT and friends fall back to the closest catalog we have
  en: 'en',
};

/**
 * Picks the first supported language from the browser's preference list (navigator.languages).
 * Pure on purpose: the caller passes the list in, so it is testable without a browser.
 */
export function detectLocale(
  preferred: readonly string[],
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  for (const tag of preferred) {
    const primary = tag.trim().toLowerCase().split('-')[0] ?? '';
    const match = PRIMARY_SUBTAG_TO_LOCALE[primary];
    if (match !== undefined) return match;
  }
  return fallback;
}
