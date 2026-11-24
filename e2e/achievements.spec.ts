import { ACHIEVEMENTS } from '../src/data/achievements';
import { expect, test } from './support/fixtures';

const save = (overrides: Record<string, unknown> = {}) => ({
  version: 2,
  playerName: '',
  points: 0,
  coins: 0,
  highestUnlockedLevel: 1,
  clearedLevels: [],
  bestScoreByLevel: {},
  ownedSkins: ['classic'],
  equippedSkin: 'classic',
  settings: { muted: false, volume: 1, locale: null },
  ...overrides,
});

test.describe('achievements screen', () => {
  test('lists every achievement as locked, with its hint, progress and reward', async ({
    game,
    page,
  }) => {
    await game.tile('achievements').click();
    await game.expectScreen('achievements');
    const screen = game.overlay('achievements');
    await expect(screen.locator('.overlay__title')).toHaveText('Achievements');
    await expect(screen.locator('.overlay__text')).toHaveText(`0 of ${ACHIEVEMENTS.length} earned`);
    await expect(page.locator('.achievements__item')).toHaveCount(ACHIEVEMENTS.length);

    const combo = page.locator('[data-achievement="combo-4"]');
    await expect(combo).toHaveAttribute('data-state', 'locked');
    await expect(combo.locator('.achievements__name')).toHaveText('Sharp Aim');
    await expect(combo.locator('.achievements__hint')).toHaveText('Hit 4 crabs in a row.');
    await expect(combo.locator('.achievements__progress')).toHaveText('Progress: 0 of 4');
    await expect(combo.locator('.achievements__reward')).toHaveText('Reward: 10 coins');
    await expect(combo.locator('.achievements__state')).toHaveText('Locked');

    // Nothing is hidden: no achievement hides its name or its hint behind "???".
    await expect(screen).not.toContainText('???');
    await expect(
      page.locator('[data-achievement="flawless-win"] .achievements__reward'),
    ).toHaveText('Reward: skin Ember');
  });

  test('Back returns to the menu and the focus goes back to the tile', async ({ game, page }) => {
    await game.tile('achievements').click();
    await expect(game.overlay('achievements').getByRole('button', { name: 'Back' })).toBeFocused();
    await page.getByRole('button', { name: 'Back' }).click();
    await game.expectScreen('menu');
    await expect(game.tile('achievements')).toBeFocused();
  });

  test('shows what is earned and how far the others are, from the saved progress', async ({
    game,
    page,
  }) => {
    await game.seedSave(
      save({
        highestUnlockedLevel: 3,
        clearedLevels: [1, 2],
        stats: { hits: 12, bestCombo: 3, wins: 2, totalPoints: 400 },
        achievements: ['first-hit', 'clear-beach'],
      }),
    );
    await game.tile('achievements').click();
    await expect(game.overlay('achievements').locator('.overlay__text')).toHaveText(
      `2 of ${ACHIEVEMENTS.length} earned`,
    );
    const first = page.locator('[data-achievement="first-hit"]');
    await expect(first).toHaveAttribute('data-state', 'earned');
    await expect(first.locator('.achievements__state')).toHaveText('Earned');
    await expect(first.locator('.achievements__progress')).toBeHidden();
    await expect(page.locator('[data-achievement="combo-4"] .achievements__progress')).toHaveText(
      'Progress: 3 of 4',
    );
    await expect(page.locator('[data-achievement="veteran"] .achievements__progress')).toHaveText(
      'Progress: 2 of 50',
    );
    await expect(
      page.locator('[data-achievement="clear-rocks"] .achievements__progress'),
    ).toHaveText('Progress: 0 of 3');
  });

  test('an old save with no counters opens with everything at zero and loses nothing', async ({
    game,
    page,
  }) => {
    await game.seedSave(save({ coins: 77, ownedSkins: ['classic', 'ocean'] }));
    await game.tile('achievements').click();
    await expect(game.overlay('achievements').locator('.overlay__text')).toHaveText(
      `0 of ${ACHIEVEMENTS.length} earned`,
    );
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 77 coins');
  });

  test('is in Portuguese too', async ({ game, page }) => {
    await game.chooseLanguage('Português');
    await game.tile('achievements').click();
    const screen = game.overlay('achievements');
    await expect(screen.locator('.overlay__title')).toHaveText('Conquistas');
    await expect(screen.locator('.overlay__text')).toHaveText(
      `0 de ${ACHIEVEMENTS.length} conquistadas`,
    );
    const combo = page.locator('[data-achievement="combo-4"]');
    await expect(combo.locator('.achievements__name')).toHaveText('Pontaria');
    await expect(combo.locator('.achievements__hint')).toHaveText('Acerte 4 caranguejos seguidos.');
    await expect(combo.locator('.achievements__progress')).toHaveText('Progresso: 0 de 4');
    await expect(combo.locator('.achievements__reward')).toHaveText('Prêmio: 10 moedas');
    await expect(combo.locator('.achievements__state')).toHaveText('Bloqueada');
  });
});

test.describe('exclusive skins in the shop', () => {
  test('are shown locked, with the achievement that gives them, and cannot be bought', async ({
    game,
    page,
  }) => {
    await game.seedSave(save({ coins: 9999 }));
    await page.getByRole('button', { name: 'Shop' }).click();
    const ember = page.locator('[data-skin="ember"]');
    await expect(ember.locator('.skins__name')).toHaveText('Ember');
    await expect(ember.locator('.skins__price')).toHaveText('Earned with: No Misses');
    await expect(ember.getByRole('button')).toHaveText('Locked');
    await expect(ember.getByRole('button')).toBeDisabled();
    await expect(page.locator('[data-skin="pearl"] .skins__price')).toHaveText(
      'Earned with: King of the Crabs',
    );
    await expect(page.locator('[data-skin="neon"] .skins__price')).toHaveText(
      'Earned with: Veteran',
    );
  });

  test('turn into an ordinary skin to use once the achievement is earned', async ({
    game,
    page,
  }) => {
    await game.seedSave(
      save({
        ownedSkins: ['classic', 'ember'],
        achievements: ['flawless-win'],
      }),
    );
    await page.getByRole('button', { name: 'Shop' }).click();
    const ember = page.locator('[data-skin="ember"] button');
    await expect(ember).toHaveText('Use');
    await expect(ember).toBeEnabled();
    await ember.click();
    await expect(ember).toHaveText('In use');
    await expect(page.locator('[data-skin="classic"] button')).toHaveText('Use');
    await game.reload();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(page.locator('[data-skin="ember"] button')).toHaveText('In use');
  });

  test('are in Portuguese', async ({ game, page }) => {
    await game.seedSave(save({ settings: { muted: false, volume: 1, locale: 'pt-BR' } }));
    await page.getByRole('button', { name: 'Loja' }).click();
    await expect(page.locator('[data-skin="ember"] .skins__name')).toHaveText('Brasa');
    await expect(page.locator('[data-skin="ember"] .skins__price')).toHaveText(
      'Ganha com: Sem errar',
    );
    await expect(page.locator('[data-skin="ember"] button')).toHaveText('Bloqueada');
  });
});

test.describe('earning one by playing', () => {
  test('a round that hits a crab earns the first achievement: told in the dialog, paid, and kept', async ({
    game,
    page,
  }) => {
    test.setTimeout(90_000);
    await game.play();
    await game.playRoundWithBot();
    await game.expectScreen('ended');
    const summary = await game.overlay('ended').locator('.overlay__text').innerText();
    expect(summary).toContain('Achievement: First Hit (5 coins)');
    expect(await game.liveText()).toContain('Achievement earned:');

    await page.getByRole('button', { name: 'Main menu' }).click();
    await game.tile('achievements').click();
    const first = page.locator('[data-achievement="first-hit"]');
    await expect(first).toHaveAttribute('data-state', 'earned');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Shop' }).click();
    // The 5 coins of "First Hit" and maybe more from the others it earned in the same round.
    const coins = Number(
      /(\d+) coin/.exec(await game.overlay('shop').locator('.overlay__text').innerText())?.[1],
    );
    expect(coins).toBeGreaterThanOrEqual(5);

    await game.reload();
    await game.tile('achievements').click();
    await expect(page.locator('[data-achievement="first-hit"]')).toHaveAttribute(
      'data-state',
      'earned',
    );
  });

  test('an achievement already earned is not told or paid again', async ({ game, page }) => {
    test.setTimeout(90_000);
    await game.seedSave(save({ achievements: ACHIEVEMENTS.map((entry) => entry.id), coins: 3 }));
    await game.play();
    await game.playRoundWithBot();
    await game.expectScreen('ended');
    expect(await game.overlay('ended').locator('.overlay__text').innerText()).not.toContain(
      'Achievement:',
    );
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 3 coins');
  });
});
