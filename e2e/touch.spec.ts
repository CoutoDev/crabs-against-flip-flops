import { expect, test } from './support/fixtures';

test.describe('touch on a phone', () => {
  test('the game starts in the browser language and a tap throws', async ({ game, page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Caranguejos vs Chinelos');
    await game.primaryButton().tap();
    await game.expectScreen('playing');

    const box = await game.canvas.boundingBox();
    if (box === null) throw new Error('no box');
    await game.throwAt({ x: 90, y: 150 }, 'touch');
    await expect.poll(async () => game.ammo()).toBe(15);
    expect(await page.evaluate(() => window.scrollY), 'the page does not scroll').toBe(0);
  });

  test('the keyboard help is hidden on a touch screen', async ({ page }) => {
    await expect(page.locator('.help')).toBeHidden();
  });

  test('the touch targets are at least 44 px', async ({ game, page }) => {
    await game.play();
    for (const button of await page.locator('button:visible').all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
