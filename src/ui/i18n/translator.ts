import type { Locale } from '../../application/locale';
import { catalogs, type Catalog } from './catalogs';
import type { Message, MessageKey } from './messages/en';

export type Params = Readonly<Record<string, string | number>>;

export interface Translator {
  readonly locale: Locale;
  t(key: MessageKey, params?: Params): string;
  formatNumber(value: number): string;
}

export function createTranslator(locale: Locale, catalog: Catalog = catalogs[locale]): Translator {
  const numberFormat = new Intl.NumberFormat(locale);
  const pluralRules = new Intl.PluralRules(locale);

  const pick = (key: MessageKey, message: Message, params?: Params): string => {
    if (typeof message === 'string') return message;
    const count = params?.['count'];
    if (typeof count !== 'number') {
      throw new Error(`i18n: plural message "${key}" requires a numeric "count" param`);
    }
    if (count === 0 && message.zero !== undefined) return message.zero;
    return message[pluralRules.select(count) === 'one' ? 'one' : 'other'];
  };

  return {
    locale,
    formatNumber: (value) => numberFormat.format(value),
    t(key, params) {
      const template = pick(key, catalog[key], params);
      return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
        const value = params?.[name];
        if (value === undefined) return placeholder; // keep it visible: a missing param is a bug
        return typeof value === 'number' ? numberFormat.format(value) : value;
      });
    },
  };
}
