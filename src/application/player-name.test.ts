import { describe, expect, it } from 'vitest';
import { MAX_PLAYER_NAME_LENGTH, sanitizePlayerName } from './player-name';

describe('sanitizePlayerName', () => {
  it('keeps an ordinary name as it is', () => {
    expect(sanitizePlayerName('Maria')).toBe('Maria');
    expect(sanitizePlayerName('João_da-Silva.2')).toBe('João_da-Silva.2');
  });

  it('trims and collapses spaces', () => {
    expect(sanitizePlayerName('   Ana    Clara  ')).toBe('Ana Clara');
  });

  it('removes markup, control characters and emoji', () => {
    expect(sanitizePlayerName('<b>Bob</b>')).toBe('bBobb');
    expect(sanitizePlayerName('Al\u0000i​ce\n')).toBe('Alice');
    expect(sanitizePlayerName('Crab 🦀')).toBe('Crab');
  });

  it('accepts names in other scripts', () => {
    expect(sanitizePlayerName('こんにちは')).toBe('こんにちは');
  });

  it('keeps combining accents and normalizes them', () => {
    expect(sanitizePlayerName('José')).toBe('José');
  });

  it('cuts to the maximum length counting characters, not UTF-16 units', () => {
    const long = 'a'.repeat(40);
    expect(sanitizePlayerName(long)).toHaveLength(MAX_PLAYER_NAME_LENGTH);
    expect(Array.from(sanitizePlayerName('𝒜'.repeat(40) + 'x')).length).toBeLessThanOrEqual(
      MAX_PLAYER_NAME_LENGTH,
    );
  });

  it('does not leave a trailing space after cutting', () => {
    expect(sanitizePlayerName('a'.repeat(15) + ' bbb')).toBe('a'.repeat(15));
  });

  it('turns a name with nothing usable into an empty one', () => {
    expect(sanitizePlayerName('   ')).toBe('');
    expect(sanitizePlayerName('🦀🦀')).toBe('');
  });
});
