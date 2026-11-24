import { test as base, expect } from '@playwright/test';
import { GamePage, type ConsentSeed } from './game-page';

interface Options {
  /** What the visitor already chose about analytics when the test starts. */
  consent: ConsentSeed;
  /** The browser sends the Global Privacy Control signal. */
  privacySignal: boolean;
}

/** `game` is opened on the menu and, after each test, must not have logged any error. */
export const test = base.extend<{ game: GamePage } & Options>({
  consent: ['denied', { option: true }],
  privacySignal: [false, { option: true }],
  game: async ({ page, consent, privacySignal }, use) => {
    const game = new GamePage(page);
    await game.open({ consent, privacySignal });
    await use(game);
    expect(game.problems, 'no console or page errors').toEqual([]);
  },
});

export { expect };
