import { describe, expect, it } from 'vitest';
import { detectLocale } from './detect-locale';

describe('detectLocale', () => {
  it('maps Brazilian Portuguese to pt-BR', () => {
    expect(detectLocale(['pt-BR', 'en-US'])).toBe('pt-BR');
  });

  it('maps any English variant to en', () => {
    expect(detectLocale(['en-GB'])).toBe('en');
  });

  it('falls back from other Portuguese variants to pt-BR', () => {
    expect(detectLocale(['pt-PT'])).toBe('pt-BR');
  });

  it('skips unsupported languages and takes the first supported one', () => {
    expect(detectLocale(['fr-FR', 'pt'])).toBe('pt-BR');
  });

  it('is case-insensitive', () => {
    expect(detectLocale(['PT-br'])).toBe('pt-BR');
  });

  it('uses the fallback when nothing is supported or the list is empty', () => {
    expect(detectLocale(['fr', 'de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
    expect(detectLocale(['fr'], 'pt-BR')).toBe('pt-BR');
  });
});
