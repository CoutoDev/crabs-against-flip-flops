import { test as base, expect } from '@playwright/test';
import { GamePage } from './game-page';

/** `game` is opened on the menu and, after each test, must not have logged any error. */
export const test = base.extend<{ game: GamePage }>({
  game: async ({ page }, use) => {
    const game = new GamePage(page);
    await game.open();
    await use(game);
    expect(game.problems, 'no console or page errors').toEqual([]);
  },
});

export { expect };
