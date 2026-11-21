import type { Locale } from '../../application/locale';
import { en, type Message, type MessageKey } from './messages/en';
import { ptBR } from './messages/pt-BR';

export type Catalog = Readonly<Record<MessageKey, Message>>;

/** `Record<Locale, …>` makes adding a locale to LOCALES a compile error until it has a catalog. */
export const catalogs: Readonly<Record<Locale, Catalog>> = {
  en,
  'pt-BR': ptBR,
};
