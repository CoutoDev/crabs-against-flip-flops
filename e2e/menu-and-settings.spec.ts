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

  test('has a bottom bar with the shop, the achievements, the audio and the language, each with a caption', async ({
    game,
  }) => {
    await expect(game.tile('shop')).toHaveAccessibleName('Shop');
    await expect(game.tile('achievements')).toHaveAccessibleName('Achievements');
    await expect(game.tile('audio')).toHaveAccessibleName('Audio');
    await expect(game.tile('language')).toHaveAccessibleName('Language');
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
    await game.chooseLanguage('Português');
    await expect(page.locator('.levels__selected')).toHaveText('Nível 1 · Praia Calma');
    await expect(page.locator('.levels__group button').nth(2)).toHaveAccessibleName(
      'Nível 3: bloqueado',
    );
  });

  test('the Play button stays reachable on the menu', async ({ game }) => {
    await expect(game.primaryButton()).toBeInViewport();
  });
});

test.describe('audio screen', () => {
  test('opens from the menu, with the sound switch focused and the HUD still hidden', async ({
    game,
    page,
  }) => {
    await game.openAudio();
    await expect(game.overlay('audio').locator('.overlay__title')).toHaveText('Audio');
    await expect(game.soundSwitch()).toBeFocused();
    await expect(page.locator('.hud')).toBeHidden();
    await expect(page.getByRole('switch', { name: 'Sound effects' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Music' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(game.volume()).toHaveValue('100');
  });

  test('Back returns to the menu with the focus on the button that opened the screen', async ({
    game,
  }) => {
    await game.openAudio();
    await game.back();
    await game.expectScreen('menu');
    await expect(game.tile('audio')).toBeFocused();
  });

  test('Esc is Back', async ({ game, page }) => {
    await game.openAudio();
    await page.keyboard.press('Escape');
    await game.expectScreen('menu');
  });

  test('the sound switch says its state in words and in the accessibility tree', async ({
    game,
  }) => {
    await game.openAudio();
    await expect(game.soundSwitch()).toContainText('On');
    await game.soundSwitch().click();
    await expect(game.soundSwitch()).toHaveAttribute('aria-checked', 'false');
    await expect(game.soundSwitch()).toContainText('Off');
  });

  test('a muted game makes no sound', async ({ game, page }) => {
    await game.openAudio();
    await game.soundSwitch().click();
    await expect(game.soundSwitch()).toHaveAttribute('aria-checked', 'false');
    await page.waitForTimeout(400); // lets the notes already scheduled finish
    const before = (await game.audioSpy()).oscillators;
    await game.back();
    await game.play();
    await game.throwAt({ x: 90, y: 150 });
    await expect.poll(async () => game.ammo()).toBe(15);
    await page.waitForTimeout(500);
    expect((await game.audioSpy()).oscillators, 'nothing new after muting').toBe(before);
  });

  test('opened from the pause it keeps the round paused and returns to the pause', async ({
    game,
    page,
  }) => {
    await game.play();
    await page.keyboard.press('p');
    await game.expectScreen('paused');
    await game.openAudio();
    await expect(page.locator('.hud')).toBeVisible();
    await game.back();
    await game.expectScreen('paused');
    await expect(game.tile('audio')).toBeFocused();
    await game.primaryButton().click();
    await game.expectScreen('playing');
  });
});

test.describe('language screen', () => {
  test('opens from the menu with the language in use marked and focused', async ({ game }) => {
    await game.openLanguage();
    await expect(game.overlay('language').locator('.overlay__title')).toHaveText('Language');
    await expect(game.language('English')).toHaveAttribute('aria-pressed', 'true');
    await expect(game.language('Português')).toHaveAttribute('aria-pressed', 'false');
    await expect(game.language('English')).toBeFocused();
  });

  test('choosing a language rewrites every text at once, and Back comes home', async ({
    game,
    page,
  }) => {
    await game.openLanguage();
    await game.language('Português').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(game.overlay('language').locator('.overlay__title')).toHaveText('Idioma');
    await expect(game.language('Português')).toHaveAttribute('aria-pressed', 'true');
    await game.back();
    await game.expectScreen('menu');
    await expect(game.primaryButton()).toHaveText('Jogar');
    await expect(game.tile('language')).toHaveAccessibleName('Idioma');
    await expect(game.tile('language')).toBeFocused();
  });

  test('switching language during a paused round keeps the round', async ({ game, page }) => {
    await game.play();
    await page.keyboard.press('p');
    await game.expectScreen('paused');

    await game.openLanguage();
    await game.language('Português').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Caranguejos vs Chinelos');
    await expect(page.locator('.hud__item--score .hud__label')).toHaveText('Pontos');
    await expect(game.canvas).toHaveAttribute('aria-label', /Campo do jogo/);

    await game.language('English').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await game.back();
    await game.expectScreen('paused');

    await game.primaryButton().click();
    await game.expectScreen('playing');
  });
});
