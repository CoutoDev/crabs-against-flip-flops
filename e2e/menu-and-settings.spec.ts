import { expect, test } from './support/fixtures';

test.describe('menu', () => {
  test('opens on the menu with the Play button focused and no HUD', async ({ game, page }) => {
    await game.expectScreen('menu');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crabs Against Flip Flops');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.hud')).toBeHidden();
    await expect(game.primaryButton()).toBeFocused();
    await expect(game.primaryButton()).toHaveText('Play');
  });

  test('Play starts a round with full ammo and the canvas focused', async ({ game }) => {
    await game.play();
    await expect(game.canvas).toBeFocused();
    await expect(game.hud('ammo')).toHaveText('16');
    await expect(game.hud('score')).toHaveText('0 / 100');
    expect((await game.audioSpy()).contexts, 'audio is unlocked by the Play gesture').toBe(1);
  });
});

test.describe('level picker', () => {
  test('a new player can only open level 1; the others are locked', async ({ game, page }) => {
    const picker = page.locator('.levels__group button');
    await expect(picker).toHaveCount(12);
    await expect(picker.first()).toBeEnabled();
    await expect(picker.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.first()).toHaveAccessibleName('Level 1: Sandy Shore');
    await expect(picker.nth(1)).toBeDisabled();
    await expect(picker.nth(1)).toHaveAccessibleName('Level 2: locked');
    await expect(picker.last()).toBeDisabled();
    await expect(page.locator('.levels__selected')).toHaveText('Level 1 · Sandy Shore');
    await expect(game.canvas).toHaveAttribute('aria-label', /across the beach/);
  });

  test('the picker is in Portuguese too', async ({ game, page }) => {
    await game.expectScreen('menu');
    await page.getByRole('button', { name: 'Português' }).click();
    await expect(page.locator('.levels__selected')).toHaveText('Nível 1 · Praia Calma');
    await expect(page.locator('.levels__group button').nth(2)).toHaveAccessibleName(
      'Nível 3: bloqueado',
    );
  });

  test('the Play button stays reachable on the menu', async ({ game }) => {
    await expect(game.primaryButton()).toBeInViewport();
  });
});

test.describe('settings', () => {
  test('language switch rewrites every text and keeps the round running', async ({
    game,
    page,
  }) => {
    await game.play();
    await page.keyboard.press('p');
    await game.expectScreen('paused');

    await page.getByRole('button', { name: 'Português' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Caranguejos vs Chinelos');
    await expect(page.locator('.hud__item--score .hud__label')).toHaveText('Pontos');
    await expect(game.canvas).toHaveAttribute('aria-label', /Campo do jogo/);
    await expect(page.getByRole('button', { name: 'Português' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await game.primaryButton().click();
    await game.expectScreen('playing');
  });

  test('sound toggle reflects its state', async ({ game, page }) => {
    const on = page.getByRole('button', { name: /Sound: on/ });
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await on.click();
    await expect(page.getByRole('button', { name: /Sound: off/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await game.play();
    await game.throwAt({ x: 90, y: 150 });
    await expect.poll(async () => game.ammo()).toBe(15);
    expect((await game.audioSpy()).oscillators, 'a muted game makes no sound').toBe(0);
  });
});
