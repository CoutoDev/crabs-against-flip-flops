import { expect, test } from './support/fixtures';

test.describe('level briefing', () => {
  test('shows the targets of the level with their pictures, name and points', async ({
    game,
    page,
  }) => {
    await game.openBriefing();
    const briefing = game.overlay('briefing');
    await expect(briefing.locator('.overlay__title')).toHaveText('Level 1 · Sandy Shore');
    await expect(briefing.locator('.overlay__text')).toHaveText('Your targets');

    // Level 1 has common crabs only.
    const items = briefing.locator('.targets__item');
    await expect(items).toHaveCount(1);
    await expect(items.first().locator('.targets__name')).toHaveText('Crab');
    await expect(items.first().locator('.targets__points')).toHaveText('10 points');

    // The picture is real art: its canvas has painted pixels, not an empty rectangle.
    const painted = await items
      .first()
      .locator('canvas')
      .evaluate((c: HTMLCanvasElement) => {
        const data = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
        return data === undefined
          ? 0
          : data.filter((_, i) => i % 4 === 3 && data[i] === 255).length;
      });
    expect(painted).toBeGreaterThan(20);
    await expect(game.primaryButton()).toBeFocused();
    await expect(game.primaryButton()).toHaveText('Start');
    expect(page.url()).toBeTruthy();
  });

  test('the round stays frozen until Start', async ({ game, page }) => {
    await game.openBriefing();
    await page.waitForTimeout(1500);
    await game.throwAt({ x: 90, y: 150 });
    expect(await game.ammo(), 'a click behind the briefing does not throw').toBe(16);
    await game.primaryButton().click();
    await game.expectScreen('playing');
    expect(await game.ammo()).toBe(16);
  });

  test('Main menu on the briefing goes back to the menu', async ({ game, page }) => {
    await game.openBriefing();
    await page.getByRole('button', { name: 'Main menu' }).click();
    await game.expectScreen('menu');
  });

  test('the HUD shows the level name under the level number', async ({ game, page }) => {
    await game.play();
    const name = page.locator('.hud__name');
    await expect(name).toHaveText('Sandy Shore');
    const level = await game.hud('level').boundingBox();
    const nameBox = await name.boundingBox();
    if (level === null || nameBox === null) throw new Error('no layout');
    expect(nameBox.y, 'the name sits below the level').toBeGreaterThan(level.y + level.height - 1);
  });

  test('retrying after a loss skips the briefing', async ({ game, page }) => {
    await game.play();
    // Throw every flip flop at an empty corner to lose quickly.
    for (let i = 0; i < 16; i++) {
      await game.throwAt({ x: 5, y: 5 });
      await page.waitForTimeout(60);
    }
    await game.expectScreen('ended');
    await game.primaryButton().click();
    await game.expectScreen('playing');
  });
});
