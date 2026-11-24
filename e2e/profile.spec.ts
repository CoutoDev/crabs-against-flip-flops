import { expect, test } from './support/fixtures';

const save = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  playerName: '',
  balance: 0,
  highestUnlockedLevel: 1,
  bestScoreByLevel: {},
  ownedSkins: ['classic'],
  equippedSkin: 'classic',
  settings: { muted: false, volume: 1, locale: null },
  ...overrides,
});

test.describe('player name', () => {
  test('is optional, saved and still there after a reload', async ({ game, page }) => {
    const name = page.getByLabel('Your name');
    await expect(name).toHaveValue('');
    await name.fill('Maria');
    await name.blur();
    await game.reload();
    await expect(page.getByLabel('Your name')).toHaveValue('Maria');
  });

  test('is cleaned when the player leaves the field', async ({ game, page }) => {
    const name = page.getByLabel('Your name');
    await name.fill('  <b>Bob</b>   🦀  ');
    await name.blur();
    await expect(name).toHaveValue('bBobb');
    await game.reload();
    await expect(page.getByLabel('Your name')).toHaveValue('bBobb');
  });

  test('typing in it never starts, pauses or aims anything', async ({ game, page }) => {
    await page.getByLabel('Your name').fill('');
    await page.getByLabel('Your name').pressSequentially('p wasd Enter ');
    await game.expectScreen('menu');
    await expect(page.getByLabel('Your name')).toHaveValue('p wasd Enter ');
  });
});

test.describe('shop', () => {
  test('shows what the player can afford and buys and equips a skin', async ({ game, page }) => {
    await game.seedSave(save({ balance: 200 }));
    await page.getByRole('button', { name: 'Shop' }).click();
    await game.expectScreen('shop');
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 200 points');

    const row = (id: string) => page.locator(`[data-skin="${id}"]`);
    await expect(row('classic').getByRole('button')).toHaveText('In use');
    await expect(row('classic').getByRole('button')).toBeDisabled();
    await expect(row('ocean').getByRole('button')).toBeEnabled();
    await expect(row('ocean').locator('.skins__price')).toHaveText('75 points');
    await expect(row('gold').getByRole('button')).toBeDisabled(); // 750 points: out of reach

    const buy = row('ocean').getByRole('button');
    await buy.click();
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 125 points');
    await expect(buy).toHaveText('Use');
    await expect(buy).toBeFocused(); // the pressed button keeps the focus while it changes
    expect(await game.liveText()).toBe('Ocean bought');

    await buy.click();
    await expect(buy).toHaveText('In use');
    await expect(row('classic').getByRole('button')).toHaveText('Use');
    expect(await game.liveText()).toBe('Using Ocean');

    await game.reload();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 125 points');
    await expect(row('ocean').getByRole('button')).toHaveText('In use');
  });

  test('the picture of each skin has its own colors', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Shop' }).click();
    const colors = await page.locator('.skins__icon canvas').evaluateAll((canvases) =>
      (canvases as HTMLCanvasElement[]).map((canvas) => {
        const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
        const seen = new Set<string>();
        for (let i = 0; data !== undefined && i < data.length; i += 4) {
          if (data[i + 3] === 255) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }
        return [...seen].sort().join('|');
      }),
    );
    expect(colors).toHaveLength(7);
    expect(new Set(colors).size).toBe(7);
    await expect(game.overlay('shop').getByRole('button', { name: 'Back' })).toBeFocused();
  });

  test('Back returns to the menu', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Shop' }).click();
    await game.expectScreen('shop');
    await page.getByRole('button', { name: 'Back' }).click();
    await game.expectScreen('menu');
  });

  test('is in Portuguese too', async ({ game, page }) => {
    await game.seedSave(
      save({ balance: 5, settings: { muted: false, volume: 1, locale: 'pt-BR' } }),
    );
    await page.getByRole('button', { name: 'Loja' }).click();
    await expect(game.overlay('shop').locator('.overlay__title')).toHaveText('Loja de chinelos');
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('Você tem 5 pontos');
    await expect(page.locator('[data-skin="ocean"] .skins__name')).toHaveText('Oceano');
  });

  test('the points of a round go to the balance, win or lose', async ({ game, page }) => {
    test.setTimeout(90_000);
    await game.play();
    await game.playRoundWithBot();
    await game.expectScreen('ended');
    const summary = await game.overlay('ended').locator('.overlay__text').innerText();
    const score = Number(/Score (\d+)/.exec(summary)?.[1]);
    expect(score).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText(
      `You have ${score} points`,
    );
  });
});

test.describe('saved progress and settings', () => {
  test('the campaign resumes where the player stopped', async ({ game, page }) => {
    await game.seedSave(save({ highestUnlockedLevel: 3, bestScoreByLevel: { 1: 150 } }));
    const picker = page.locator('.levels__group button');
    await expect(picker.nth(2)).toBeEnabled();
    await expect(picker.nth(3)).toBeDisabled();
    await expect(page.locator('.levels__selected')).toHaveText('Level 3 · Swimmers Ahoy');
    await game.openBriefing();
    await expect(game.overlay('briefing').locator('.overlay__title')).toHaveText(
      'Level 3 · Swimmers Ahoy',
    );
  });

  test('the language and the sound choice are remembered', async ({ game, page }) => {
    await game.chooseLanguage('Português');
    await game.openAudio();
    await game.soundSwitch().click();
    await game.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await game.openAudio();
    await expect(page.getByRole('switch', { name: 'Efeitos sonoros' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await game.back();
    await game.openLanguage();
    await expect(game.language('Português')).toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('a damaged save', () => {
    test('is ignored: the game starts as new, without errors', async ({ game, page }) => {
      await game.seedSave('{ this is not json');
      await game.expectScreen('menu');
      await expect(page.locator('.levels__group button').nth(1)).toBeDisabled();
      await page.getByRole('button', { name: 'Shop' }).click();
      await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 0 points');
    });

    test('is repaired field by field, keeping what is valid', async ({ game, page }) => {
      await game.seedSave(
        save({
          balance: 'lots',
          highestUnlockedLevel: 2,
          equippedSkin: 'gold', // not owned
          ownedSkins: ['classic', 'unicorn'],
          playerName: 'Ana',
        }),
      );
      await expect(page.getByLabel('Your name')).toHaveValue('Ana');
      await expect(page.locator('.levels__group button').nth(1)).toBeEnabled();
      await page.getByRole('button', { name: 'Shop' }).click();
      await expect(page.locator('[data-skin="classic"]').getByRole('button')).toHaveText('In use');
      await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 0 points');
    });
  });
});
