import { expect, test } from './support/fixtures';

test.describe('desktop layout', () => {
  test.use({ viewport: { width: 1280, height: 1500 } });

  test('a tall desktop window gets a bigger field, still centered', async ({
    game,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const box = await game.canvas.boundingBox();
    if (box === null) throw new Error('no box');
    expect(box.width, '3x or more').toBeGreaterThanOrEqual(540);
    const centerX = box.x + box.width / 2;
    expect(Math.abs(centerX - 640)).toBeLessThanOrEqual(1);
    await expect(page.locator('.help')).toBeVisible();
  });
});
