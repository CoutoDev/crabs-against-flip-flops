import type { Message, MessageKey } from './en';

export const ptBR: Readonly<Record<MessageKey, Message>> = {
  'game.title': 'Caranguejos vs Chinelos',
  'game.tagline': 'Arremesse chinelos nos caranguejos!',
  'menu.play': 'Jogar',
  'score.points': { zero: '{count} pontos', one: '{count} ponto', other: '{count} pontos' },
  'settings.language': 'Idioma',
  'language.pt-BR': 'Português (Brasil)',
  'language.en': 'English',
};
