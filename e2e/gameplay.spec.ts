import { expect, test } from './support/fixtures';

test('a bot that only looks at the pixels can play a whole round', async ({ game, page }) => {
  test.setTimeout(90_000);
  await game.play();

  const { throws, bestScore } = await game.playRoundWithBot();

  await game.expectScreen('ended');
  expect(throws, 'the round ends within the ammo limit').toBeLessThanOrEqual(40);
  expect(bestScore, 'hitting crabs through the real UI scores points').toBeGreaterThan(0);
  expect(await game.liveText(), 'a milestone was announced').toMatch(/Milestone: \d+/);

  const ended = game.overlay('ended');
  await expect(ended.locator('.overlay__title')).toHaveText(/Level cleared!|Out of flip flops!/);
  await expect(ended.locator('.overlay__text')).toHaveText(/\d+ hits in \d+ throws/);
  await expect(game.primaryButton()).toBeFocused();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeHidden();

  // Retrying starts from scratch.
  await page.keyboard.press('Enter');
  await game.expectScreen('playing');
  expect(await game.ammo()).toBe(16);
  expect(await game.score()).toBe(0);
});
