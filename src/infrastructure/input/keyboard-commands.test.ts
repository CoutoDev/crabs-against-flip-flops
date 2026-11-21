import { describe, expect, it } from 'vitest';
import { commandForKey, type KeyInfo } from './keyboard-commands';

const key = (k: string, overrides: Partial<KeyInfo> = {}): KeyInfo => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  ...overrides,
});

describe('commandForKey', () => {
  it('aims with arrows and WASD, in either letter case', () => {
    expect(commandForKey(key('ArrowLeft'))).toEqual({ kind: 'aim', dx: -1, dy: 0, fast: false });
    expect(commandForKey(key('ArrowRight'))).toEqual({ kind: 'aim', dx: 1, dy: 0, fast: false });
    expect(commandForKey(key('ArrowUp'))).toEqual({ kind: 'aim', dx: 0, dy: -1, fast: false });
    expect(commandForKey(key('ArrowDown'))).toEqual({ kind: 'aim', dx: 0, dy: 1, fast: false });
    expect(commandForKey(key('a'))).toEqual({ kind: 'aim', dx: -1, dy: 0, fast: false });
    expect(commandForKey(key('W'))).toEqual({ kind: 'aim', dx: 0, dy: -1, fast: false });
  });

  it('aims faster while Shift is held', () => {
    expect(commandForKey(key('ArrowRight', { shiftKey: true }))).toEqual({
      kind: 'aim',
      dx: 1,
      dy: 0,
      fast: true,
    });
  });

  it('keeps aiming while a key is held down', () => {
    expect(commandForKey(key('ArrowLeft', { repeat: true }))?.kind).toBe('aim');
  });

  it('throws with Space or Enter, but not by holding the key', () => {
    expect(commandForKey(key(' '))).toEqual({ kind: 'throw' });
    expect(commandForKey(key('Enter'))).toEqual({ kind: 'throw' });
    expect(commandForKey(key(' ', { repeat: true }))).toBeUndefined();
  });

  it('pauses with P or Escape, but not by holding the key', () => {
    expect(commandForKey(key('p'))).toEqual({ kind: 'pause' });
    expect(commandForKey(key('P'))).toEqual({ kind: 'pause' });
    expect(commandForKey(key('Escape'))).toEqual({ kind: 'pause' });
    expect(commandForKey(key('Escape', { repeat: true }))).toBeUndefined();
  });

  it('leaves browser shortcuts alone', () => {
    expect(commandForKey(key('a', { ctrlKey: true }))).toBeUndefined();
    expect(commandForKey(key('p', { metaKey: true }))).toBeUndefined();
    expect(commandForKey(key('ArrowLeft', { altKey: true }))).toBeUndefined();
  });

  it('ignores every other key', () => {
    expect(commandForKey(key('q'))).toBeUndefined();
    expect(commandForKey(key('Tab'))).toBeUndefined();
  });
});
