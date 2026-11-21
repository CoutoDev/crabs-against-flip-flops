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

  // The main button moves on after a win (next level) and retries after a loss; both start fresh.
  const won = /Level cleared!/.test(await ended.locator('.overlay__title').innerText());
  await page.keyboard.press('Enter');
  if (won) {
    await game.expectScreen('briefing');
    await page.keyboard.press('Enter');
  }
  await game.expectScreen('playing');
  await expect(game.hud('level')).toHaveText(won ? 'Level 2' : 'Level 1');
  expect(await game.ammo()).toBe(16);
  expect(await game.score()).toBe(0);
});
