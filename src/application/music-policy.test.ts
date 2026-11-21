import { describe, expect, it } from 'vitest';
import type { Screen } from './game-flow';
import { musicFor } from './music-policy';

describe('musicFor', () => {
  it.each(['menu', 'shop', 'briefing', 'playing'] as const)('plays the biome on %s', (screen) => {
    expect(musicFor(screen, 'rocks')).toBe('rocks');
  });

  it.each(['paused', 'ended'] as const)('is silent on %s', (screen) => {
    expect(musicFor(screen, 'rocks')).toBeUndefined();
  });

  it('covers every screen', () => {
    const screens: Record<Screen, true> = {
      menu: true,
      shop: true,
      briefing: true,
      playing: true,
      paused: true,
      ended: true,
    };
    for (const screen of Object.keys(screens) as Screen[]) musicFor(screen, 'beach');
  });
});
