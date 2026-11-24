import { ACHIEVEMENTS } from '../src/data/achievements';
import { POINTS_PER_COIN as RATE } from '../src/data/economy';
import { SKINS } from '../src/data/skins';
import { expect, test } from './support/fixtures';

const save = (overrides: Record<string, unknown> = {}) => ({
  version: 2,
  playerName: '',
  points: 0,
  coins: 0,
  highestUnlockedLevel: 1,
  clearedLevels: [],
  bestScoreByLevel: {},
  ownedSkins: ['classic'],
  equippedSkin: 'classic',
  settings: { muted: false, volume: 1, locale: null },
  ...overrides,
});

/** Every achievement already earned: a round played by a bot can then not pay any coins. */
const EARNED_ALL = ACHIEVEMENTS.map((entry) => entry.id);
const SKIN_COUNT = SKINS.length;

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
  const balance = (game: { overlay(name: 'shop'): import('@playwright/test').Locator }) =>
    game.overlay('shop').locator('.overlay__text');

  test('shows what the player can afford and buys and equips a skin with coins', async ({
    game,
    page,
  }) => {
    await game.seedSave(save({ coins: 100 }));
    await page.getByRole('button', { name: 'Shop' }).click();
    await game.expectScreen('shop');
    await expect(balance(game)).toHaveText('You have 100 coins');

    const row = (id: string) => page.locator(`[data-skin="${id}"]`);
    await expect(row('classic').getByRole('button')).toHaveText('In use');
    await expect(row('classic').getByRole('button')).toBeDisabled();
    await expect(row('ocean').getByRole('button')).toBeEnabled();
    await expect(row('ocean').locator('.skins__price')).toHaveText('40 coins');
    await expect(row('lime').getByRole('button')).toBeEnabled(); // 80 coins
    await expect(row('pink').getByRole('button')).toBeDisabled(); // 200 coins: out of reach
    await expect(row('gold').getByRole('button')).toBeDisabled(); // 600 coins: out of reach

    const buy = row('ocean').getByRole('button');
    await buy.click();
    await expect(balance(game)).toHaveText('You have 60 coins');
    await expect(buy).toHaveText('Use');
    await expect(buy).toBeFocused(); // the pressed button keeps the focus while it changes
    expect(await game.liveText()).toBe('Ocean bought');

    await buy.click();
    await expect(buy).toHaveText('In use');
    await expect(row('classic').getByRole('button')).toHaveText('Use');
    expect(await game.liveText()).toBe('Using Ocean');

    await game.reload();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(balance(game)).toHaveText('You have 60 coins');
    await expect(row('ocean').getByRole('button')).toHaveText('In use');
  });

  test('points alone buy nothing: they have to be converted into coins first', async ({
    game,
    page,
  }) => {
    await game.seedSave(save({ points: 5000, coins: 0 }));
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(balance(game)).toHaveText('You have 0 coins');
    await expect(page.locator('[data-skin="ocean"]').getByRole('button')).toBeDisabled();
  });

  test('converts the point bank into coins, keeping what does not make a coin', async ({
    game,
    page,
  }) => {
    // Written against the rate in `data/economy.ts`, so tuning it does not break the test.
    const points = 8 * RATE + 3;
    await game.seedSave(save({ points, coins: 33 }));
    await page.getByRole('button', { name: 'Shop' }).click();
    const bank = game.overlay('shop').locator('.bank');
    await expect(bank.locator('.bank__points')).toHaveText(`Bank: ${points} points`);
    await expect(bank.locator('.bank__worth')).toHaveText(
      `Worth 8 coins · ${RATE} points = 1 coin`,
    );

    const convert = bank.getByRole('button', { name: 'Convert all' });
    await expect(convert).toHaveAttribute('aria-disabled', 'false');
    await convert.click();
    await expect(balance(game)).toHaveText('You have 41 coins');
    await expect(bank.locator('.bank__points')).toHaveText('Bank: 3 points');
    await expect(bank.locator('.bank__worth')).toHaveText(
      `Worth 0 coins · ${RATE} points = 1 coin`,
    );
    expect(await game.liveText()).toBe('Converted: 8 coins added');

    // Nothing left to convert: the button says so but keeps the keyboard focus.
    await expect(convert).toHaveAttribute('aria-disabled', 'true');
    await expect(convert).toBeFocused();
    await convert.click({ force: true }); // a press on it does nothing
    await expect(balance(game)).toHaveText('You have 41 coins');

    // The coins are then spent in the shop, and all of it survives a reload.
    await page.locator('[data-skin="ocean"]').getByRole('button').click();
    await expect(balance(game)).toHaveText('You have 1 coin');
    await game.reload();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(bank.locator('.bank__points')).toHaveText('Bank: 3 points');
    await expect(balance(game)).toHaveText('You have 1 coin');
  });

  test('keeps the points of an older save: the old balance becomes the point bank', async ({
    game,
    page,
  }) => {
    await game.seedSave({
      version: 1,
      playerName: 'Ana',
      balance: 200,
      highestUnlockedLevel: 2,
      bestScoreByLevel: { 1: 130 },
      ownedSkins: ['classic', 'ocean'],
      equippedSkin: 'ocean',
      settings: { muted: false, volume: 1, locale: null },
    });
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(balance(game)).toHaveText('You have 0 coins');
    await expect(game.overlay('shop').locator('.bank__points')).toHaveText('Bank: 200 points');
    await expect(page.locator('[data-skin="ocean"]').getByRole('button')).toHaveText('In use');
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
    expect(colors).toHaveLength(SKIN_COUNT);
    expect(new Set(colors).size).toBe(SKIN_COUNT);
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
      save({
        points: 2 * RATE + 2,
        coins: 1,
        settings: { muted: false, volume: 1, locale: 'pt-BR' },
      }),
    );
    await page.getByRole('button', { name: 'Loja' }).click();
    await expect(game.overlay('shop').locator('.overlay__title')).toHaveText('Loja de chinelos');
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('Você tem 1 moeda');
    await expect(game.overlay('shop').locator('.bank__points')).toHaveText(
      `Banco: ${2 * RATE + 2} pontos`,
    );
    await expect(game.overlay('shop').locator('.bank__worth')).toHaveText(
      `Vale 2 moedas · ${RATE} pontos = 1 moeda`,
    );
    await expect(page.locator('[data-skin="ocean"] .skins__price')).toHaveText('40 moedas');
    await expect(page.locator('[data-skin="ocean"] .skins__name')).toHaveText('Oceano');
  });

  test('the points of a round go to the point bank, win or lose', async ({ game, page }) => {
    test.setTimeout(90_000);
    await game.seedSave(save({ achievements: EARNED_ALL })); // so no coin is paid by an achievement
    await game.play();
    await game.playRoundWithBot();
    await game.expectScreen('ended');
    const summary = await game.overlay('ended').locator('.overlay__text').innerText();
    const score = Number(/Score (\d+)/.exec(summary)?.[1]);
    expect(score).toBeGreaterThan(0);
    expect(summary).toContain(`Added to your point bank: ${score} points`);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(game.overlay('shop').locator('.bank__points')).toHaveText(`Bank: ${score} points`);
    await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 0 coins');
  });

  test('a level that was already cleared sends only half of the points to the bank', async ({
    game,
    page,
  }) => {
    test.setTimeout(90_000);
    await game.seedSave(
      save({ highestUnlockedLevel: 2, clearedLevels: [1], achievements: EARNED_ALL }),
    );
    await page.locator('.levels__group button').first().click(); // level 1, already cleared
    await game.play();
    await game.playRoundWithBot();
    await game.expectScreen('ended');
    const summary = await game.overlay('ended').locator('.overlay__text').innerText();
    const score = Number(/Score (\d+)/.exec(summary)?.[1]);
    expect(score).toBeGreaterThan(0);
    const half = Math.floor(score / 2);
    expect(summary).toContain(
      `Level already cleared, so 50% went to your point bank: ${half} points`,
    );

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(game.overlay('shop').locator('.bank__points')).toHaveText(`Bank: ${half} points`);
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
      await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 0 coins');
    });

    test('is repaired field by field, keeping what is valid', async ({ game, page }) => {
      await game.seedSave(
        save({
          points: 'lots',
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
      await expect(game.overlay('shop').locator('.overlay__text')).toHaveText('You have 0 coins');
      await expect(game.overlay('shop').locator('.bank__points')).toHaveText('Bank: 0 points');
    });
  });
});
