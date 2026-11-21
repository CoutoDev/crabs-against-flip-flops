import { expect, test } from './support/fixtures';

test.describe('keyboard and pause', () => {
  test.beforeEach(async ({ game }) => {
    await game.play();
  });

  test('Space throws a flip flop, with sound, and a miss is not announced', async ({
    game,
    page,
  }) => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect.poll(async () => game.ammo()).toBe(15);
    await expect.poll(async () => (await game.audioSpy()).oscillators).toBeGreaterThan(0);
    await page.waitForTimeout(900); // long enough for the flip flop to land
    expect(await game.liveText(), 'screen readers hear milestones only').toBe('');
  });

  test('P pauses, Space on the focused Resume button resumes without throwing', async ({
    game,
    page,
  }) => {
    await page.keyboard.press('p');
    await game.expectScreen('paused');
    await expect(game.primaryButton()).toBeFocused();
    await page.keyboard.press('Space');
    await game.expectScreen('playing');
    expect(await game.ammo(), 'the Space press activated the button, it did not throw').toBe(16);
  });

  test('Escape toggles pause and losing the window focus pauses', async ({ game, page }) => {
    await page.keyboard.press('Escape');
    await game.expectScreen('paused');
    await page.keyboard.press('Escape');
    await game.expectScreen('playing');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await game.expectScreen('paused');
  });

  test('the on-screen pause button and Main menu work', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Pause' }).click();
    await game.expectScreen('paused');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await game.expectScreen('menu');
  });
});
