import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/** Counts the frames pushed to the canvas and the writes to localStorage from now on. */
async function startCounting(page: Page): Promise<void> {
  await page.evaluate(() => {
    const counts = { frames: 0, writes: 0 };
    Object.defineProperty(window, '__counts', { value: counts, configurable: true });
    const putImageData = CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof putImageData>
    ) {
      counts.frames++;
      return putImageData.apply(this, args);
    } as typeof putImageData;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      counts.writes++;
      return setItem.call(this, key, value);
    };
  });
}

const counts = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __counts: { frames: number; writes: number } }).__counts,
  );

test.describe('performance guards', () => {
  test('a screen that is not changing does not redraw the canvas', async ({ game, page }) => {
    await game.expectScreen('menu');
    await page.waitForTimeout(300); // let the first frames settle
    await startCounting(page);
    await page.waitForTimeout(1200);
    expect((await counts(page)).frames, 'menu: static').toBeLessThanOrEqual(2);

    await game.openBriefing();
    await page.waitForTimeout(300);
    const afterBriefing = (await counts(page)).frames;
    await page.waitForTimeout(1200);
    expect((await counts(page)).frames - afterBriefing, 'briefing: static').toBeLessThanOrEqual(2);
  });

  test('a paused round does not redraw either', async ({ game, page }) => {
    await game.play();
    await page.keyboard.press('p');
    await game.expectScreen('paused');
    await page.waitForTimeout(300);
    await startCounting(page);
    await page.waitForTimeout(1200);
    expect((await counts(page)).frames).toBeLessThanOrEqual(2);
  });

  test('a running round is drawn at the pace of the simulation, not faster', async ({
    game,
    page,
  }) => {
    await game.play();
    await startCounting(page);
    await page.waitForTimeout(2000);
    const { frames } = await counts(page);
    expect(frames, 'it does draw while crabs walk').toBeGreaterThan(40);
    expect(frames, 'about 60 a second at most').toBeLessThanOrEqual(2 * 65 + 4);
  });

  test('dragging the volume saves once, not once per step', async ({ game, page }) => {
    await game.openAudio();
    await startCounting(page);
    await game.volume().evaluate((input: HTMLInputElement) => {
      for (let value = 100; value >= 10; value -= 5) {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect((await counts(page)).writes, 'nothing written while dragging').toBe(0);
    await page.waitForTimeout(700);
    expect((await counts(page)).writes, 'one write after the pause').toBe(1);
  });

  test('typing a name saves once, and the volume is saved when the page is left', async ({
    game,
    page,
  }) => {
    await game.expectScreen('menu');
    await startCounting(page);
    await page.getByLabel('Your name').pressSequentially('Maria da Silva', { delay: 10 });
    expect((await counts(page)).writes).toBe(0);
    await page.getByLabel('Your name').blur();
    expect((await counts(page)).writes, 'saved when the field is left').toBe(1);

    await game.openAudio();
    await game.volume().evaluate((input: HTMLInputElement) => {
      input.value = '30';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect((await counts(page)).writes, 'flushed by pagehide').toBe(2);
    await game.reload();
    await game.openAudio();
    await expect(game.volume()).toHaveValue('30');
    await game.back();
    await expect(page.getByLabel('Your name')).toHaveValue('Maria da Silva');
  });
});

test.describe('the picture is still right after skipping frames', () => {
  test('the language switch refreshes the HUD of a paused round', async ({ game, page }) => {
    await game.play();
    await page.keyboard.press('p');
    await game.expectScreen('paused');
    await game.openLanguage();
    await game.language('Português').click();
    await expect(page.locator('.hud__item--score .hud__label')).toHaveText('Pontos');
    await expect(game.hud('level')).toHaveText('Nível 1');
  });

  test('the reticle follows the mouse (aim changes repaint the field)', async ({ game, page }) => {
    await game.play();
    const box = await game.canvas.boundingBox();
    if (box === null) throw new Error('no box');
    const snapshot = () => game.canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.7);
    await page.waitForTimeout(100);
    const a = await snapshot();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4);
    await page.waitForTimeout(100);
    expect(await snapshot()).not.toBe(a);
  });
});
