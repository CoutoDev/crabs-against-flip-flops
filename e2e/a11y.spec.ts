import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/** WCAG 2.1 A and AA rules, run by axe on every screen a player can reach. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
  );
}

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  test('menu', async ({ game, page }) => {
    await game.expectScreen('menu');
    expect(await violations(page)).toEqual([]);
  });

  test('shop', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Shop' }).click();
    await game.expectScreen('shop');
    expect(await violations(page)).toEqual([]);
  });

  test('audio', async ({ game, page }) => {
    await game.openAudio();
    expect(await violations(page)).toEqual([]);
  });

  test('language', async ({ game, page }) => {
    await game.openLanguage();
    expect(await violations(page)).toEqual([]);
  });

  test('audio opened from the pause', async ({ game, page }) => {
    await game.play();
    await page.keyboard.press('p');
    await game.openAudio();
    expect(await violations(page)).toEqual([]);
  });

  test('briefing', async ({ game, page }) => {
    await game.openBriefing();
    expect(await violations(page)).toEqual([]);
  });

  test('playing and paused', async ({ game, page }) => {
    await game.play();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press('p');
    await game.expectScreen('paused');
    expect(await violations(page)).toEqual([]);
  });

  test('end of round', async ({ game, page }) => {
    await game.play();
    for (let i = 0; i < 16; i++) {
      await game.throwAt({ x: 5, y: 5 });
      await page.waitForTimeout(60);
    }
    await game.expectScreen('ended');
    expect(await violations(page)).toEqual([]);
  });

  test('menu in Portuguese', async ({ game, page }) => {
    await game.expectScreen('menu');
    await game.chooseLanguage('Português');
    expect(await violations(page)).toEqual([]);
    await game.openAudio();
    expect(await violations(page)).toEqual([]);
    await game.back();
    await game.openLanguage();
    expect(await violations(page)).toEqual([]);
  });
});
