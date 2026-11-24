import { expect, test } from './support/fixtures';

const GTM = 'https://www.googletagmanager.com/gtm.js?id=GTM-MCWMM5C6';

test.describe('analytics events (after the player accepted)', () => {
  test.use({ consent: 'granted' });

  test('Tag Manager starts on its own, with consent granted for analytics only', async ({
    game,
  }) => {
    await game.expectScreen('menu');
    await expect.poll(() => game.analyticsRequests).toEqual([GTM]);
    const layer = await game.dataLayer();
    expect(layer[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      },
    ]);
    expect(layer[1]).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(layer[2]).toMatchObject({ event: 'gtm.js' });
  });

  test('a round reports its start, its pause and its end', async ({ game, page }) => {
    await game.play();
    expect(await game.events('level_start')).toEqual([
      { event: 'level_start', level_id: 1, biome: 'beach' },
    ]);

    await page.keyboard.press('p');
    await game.expectScreen('paused');
    expect(await game.events('game_pause')).toEqual([{ event: 'game_pause', level_id: 1 }]);
    await page.keyboard.press('p');
    expect(await game.events('level_start'), 'resuming is not a new start').toHaveLength(1);

    for (let i = 0; i < 16; i++) {
      await game.throwAt({ x: 5, y: 5 });
      await page.waitForTimeout(60);
    }
    await game.expectScreen('ended');
    expect(await game.events('level_end')).toEqual([
      {
        event: 'level_end',
        level_id: 1,
        biome: 'beach',
        success: false,
        score: 0,
        hits: 0,
        throws: 16,
        accuracy_pct: 0,
        new_best: false,
      },
    ]);
  });

  test('leaving a running round from the pause is a quit', async ({ game, page }) => {
    await game.play();
    await page.keyboard.press('p');
    await game.primaryButton().waitFor();
    await page.getByRole('button', { name: 'Main menu' }).click();
    expect(await game.events('level_quit')).toEqual([
      { event: 'level_quit', level_id: 1, biome: 'beach' },
    ]);
  });

  test('settings and shop actions are reported with ids and numbers', async ({ game, page }) => {
    await game.chooseLanguage('Português');
    expect(await game.events('language_change')).toEqual([
      { event: 'language_change', language: 'pt-BR' },
    ]);
    await game.openAudio();
    await game.musicSwitch().click();
    await game.volume().fill('40');
    await expect
      .poll(() => game.events('audio_change'))
      .toEqual([
        { event: 'audio_change', setting: 'music', value: 0 },
        { event: 'audio_change', setting: 'volume', value: 40 },
      ]);
    await game.back();
    expect(await page.evaluate(() => document.title)).toBeTruthy();
  });

  test('the player name is never sent', async ({ game, page }) => {
    await page.getByLabel('Your name').fill('Maria da Silva');
    await page.getByLabel('Your name').blur();
    await game.play();
    await page.keyboard.press('p');
    const layer = JSON.stringify(await game.dataLayer());
    expect(layer).not.toContain('Maria');
    expect(layer).not.toContain('Silva');
  });
});

test.describe('no analytics without a yes', () => {
  test('a visitor who refused sends and loads nothing, even while playing', async ({ game }) => {
    await game.play();
    expect(game.analyticsRequests).toEqual([]);
    const layer = await game.dataLayer();
    expect(layer).toHaveLength(1); // only the "everything denied" default
    expect(await game.events('level_start')).toEqual([]);
  });
});
