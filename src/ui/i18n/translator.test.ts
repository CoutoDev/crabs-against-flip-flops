import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../application/locale';
import { catalogs } from './catalogs';
import { en, type Message, type MessageKey } from './messages/en';
import { createTranslator } from './translator';

const placeholders = (message: Message): string[] => {
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  const names = texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ''));
  return [...new Set(names)].sort();
};

describe('createTranslator', () => {
  it('translates simple keys in each locale', () => {
    expect(createTranslator('en').t('game.title')).toBe('Crabs Against Flip Flops');
    expect(createTranslator('pt-BR').t('game.title')).toBe('Caranguejos vs Chinelos');
  });

  it('pluralizes in English', () => {
    const { t } = createTranslator('en');
    expect(t('score.points', { count: 1 })).toBe('1 point');
    expect(t('score.points', { count: 0 })).toBe('0 points');
    expect(t('score.points', { count: 2 })).toBe('2 points');
  });

  it('pluralizes in pt-BR, treating zero as plural', () => {
    const { t } = createTranslator('pt-BR');
    expect(t('score.points', { count: 0 })).toBe('0 pontos');
    expect(t('score.points', { count: 1 })).toBe('1 ponto');
    expect(t('score.points', { count: 2 })).toBe('2 pontos');
  });

  it('formats numbers using the locale conventions', () => {
    expect(createTranslator('en').t('score.points', { count: 1500 })).toBe('1,500 points');
    expect(createTranslator('pt-BR').t('score.points', { count: 1500 })).toBe('1.500 pontos');
  });

  it('throws when a plural message gets no numeric count', () => {
    expect(() => createTranslator('en').t('score.points')).toThrow(/count/);
  });

  it('keeps unresolved placeholders visible instead of hiding the bug', () => {
    const translator = createTranslator('en', { ...en, 'game.tagline': 'Hello {name}!' });
    expect(translator.t('game.tagline')).toBe('Hello {name}!');
    expect(translator.t('game.tagline', { name: 'Maria' })).toBe('Hello Maria!');
  });
});

describe('catalogs', () => {
  const keys = Object.keys(en) as MessageKey[];

  it.each(LOCALES)('%s has the same keys as the source catalog', (locale) => {
    expect(Object.keys(catalogs[locale]).sort()).toEqual([...keys].sort());
  });

  it.each(LOCALES)('%s keeps the same placeholders and plural shape per key', (locale) => {
    for (const key of keys) {
      const source = catalogs.en[key];
      const target = catalogs[locale][key];
      expect(typeof target, key).toBe(typeof source);
      expect(placeholders(target), key).toEqual(placeholders(source));
    }
  });
});
