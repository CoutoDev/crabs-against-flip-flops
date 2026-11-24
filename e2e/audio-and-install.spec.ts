import { expect, test } from './support/fixtures';

test.describe('audio settings', () => {
  test('music plays after the first gesture and can be switched off and on', async ({
    game,
    page,
  }) => {
    await page.getByLabel('Your name').click(); // any first gesture wakes the audio
    await expect.poll(async () => (await game.audioSpy()).oscillators).toBeGreaterThan(3);

    await game.openAudio();
    await expect(game.musicSwitch()).toHaveAttribute('aria-checked', 'true');
  });

  test('the music keeps playing on the audio screen, so the volume can be judged by ear', async ({
    game,
  }) => {
    await game.openAudio();
    await expect.poll(async () => (await game.audioSpy()).oscillators).toBeGreaterThan(3);
  });

  test('turning the music off stops new notes; the effects stay', async ({ game, page }) => {
    await game.openAudio();
    const off = game.musicSwitch();
    await off.click();
    await expect(off).toHaveAttribute('aria-checked', 'false');
    await page.waitForTimeout(400);
    const before = (await game.audioSpy()).oscillators;
    await page.waitForTimeout(900);
    expect((await game.audioSpy()).oscillators, 'no music notes').toBe(before);

    await off.click();
    await expect.poll(async () => (await game.audioSpy()).oscillators).toBeGreaterThan(before + 2);
  });

  test('the music and volume choices are remembered', async ({ game }) => {
    await game.openAudio();
    await game.musicSwitch().click();
    await game.volume().fill('40');
    await game.reload();
    await game.openAudio();
    await expect(game.musicSwitch()).toHaveAttribute('aria-checked', 'false');
    await expect(game.volume()).toHaveValue('40');
  });

  test('muting the game stops the music too', async ({ game, page }) => {
    await game.openAudio();
    await game.soundSwitch().click();
    await page.waitForTimeout(400);
    const before = (await game.audioSpy()).oscillators;
    await page.waitForTimeout(900);
    expect((await game.audioSpy()).oscillators).toBe(before);
  });

  test('the music goes quiet on pause and comes back on resume', async ({ game, page }) => {
    await game.play();
    await expect.poll(async () => (await game.audioSpy()).oscillators).toBeGreaterThan(3);
    await page.keyboard.press('p');
    await game.expectScreen('paused');
    await page.waitForTimeout(500); // lets the notes already scheduled finish
    const paused = (await game.audioSpy()).oscillators;
    await page.waitForTimeout(800);
    expect((await game.audioSpy()).oscillators, 'silent while paused').toBe(paused);
    await page.keyboard.press('p');
    await expect.poll(async () => (await game.audioSpy()).oscillators).toBeGreaterThan(paused + 2);
  });
});

test.describe('end of round summary', () => {
  test('says what the round added to the point bank and the best score of the level', async ({
    game,
    page,
  }) => {
    await game.play();
    for (let i = 0; i < 16; i++) {
      await game.throwAt({ x: 5, y: 5 });
      await page.waitForTimeout(60);
    }
    await game.expectScreen('ended');
    const text = game.overlay('ended').locator('.overlay__text');
    await expect(text).toContainText('Added to your point bank: 0 points');
    await expect(text).toContainText('Best on this level: 0 points');
  });
});

test.describe('installable app', () => {
  test('serves a manifest and icons the browser can reach', async ({ page, game }) => {
    await game.expectScreen('menu');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifestUrl = new URL(href ?? '', page.url()).toString();
    const response = await page.request.get(manifestUrl);
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as { icons: { src: string }[]; start_url: string };
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      const iconResponse = await page.request.get(new URL(icon.src, manifestUrl).toString());
      expect(iconResponse.ok(), icon.src).toBe(true);
      expect(iconResponse.headers()['content-type']).toContain('image/png');
    }
  });
});
