import { describe, expect, it } from 'vitest';
import type { Screen } from './game-flow';
import { musicFor } from './music-policy';

describe('musicFor', () => {
  it.each(['menu', 'shop', 'achievements', 'briefing', 'playing'] as const)(
    'plays the biome on %s',
    (screen) => {
      expect(musicFor(screen, 'rocks')).toBe('rocks');
    },
  );

  it.each(['paused', 'ended'] as const)('is silent on %s', (screen) => {
    expect(musicFor(screen, 'rocks')).toBeUndefined();
  });

  it.each(['audio', 'language'] as const)(
    'on %s sounds like the screen it was opened from',
    (screen) => {
      expect(musicFor(screen, 'rocks', 'menu')).toBe('rocks');
      expect(musicFor(screen, 'rocks', 'paused')).toBeUndefined();
    },
  );

  it('covers every screen', () => {
    const screens: Record<Screen, true> = {
      menu: true,
      shop: true,
      achievements: true,
      audio: true,
      language: true,
      briefing: true,
      playing: true,
      paused: true,
      ended: true,
    };
    for (const screen of Object.keys(screens) as Screen[]) musicFor(screen, 'beach');
  });
});
