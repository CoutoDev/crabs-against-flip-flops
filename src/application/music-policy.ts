import type { Biome } from '../domain/entities/level';
import type { Screen } from './game-flow';

/**
 * Which biome's music should play on a screen, if any. It plays on the menu, the shop, the
 * briefing and during the round (the biome follows the level being chosen or played), and goes
 * quiet on the pause and end screens: the pause is a pause, and the win/lose jingle needs
 * the silence.
 */
export function musicFor(screen: Screen, biome: Biome): Biome | undefined {
  switch (screen) {
    case 'menu':
    case 'shop':
    case 'briefing':
    case 'playing':
      return biome;
    case 'paused':
    case 'ended':
      return undefined;
  }
}
