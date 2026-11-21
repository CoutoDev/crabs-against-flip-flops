import { expect, test } from './support/fixtures';

/** Runs on every project: portrait phone, landscape phone and desktop all share these rules. */
test.describe('layout', () => {
  test('the field is portrait, fits the viewport and the page never scrolls', async ({
    game,
    page,
  }) => {
    for (const screen of ['menu', 'briefing', 'playing'] as const) {
      if (screen === 'briefing') await game.openBriefing();
      if (screen === 'playing') await game.primaryButton().click();
      const box = await game.stage.boundingBox();
      const field = await game.fieldSize();
      const viewport = page.viewportSize();
      if (box === null || viewport === null) throw new Error('no layout');

      expect(field.height, 'the field is taller than wide').toBeGreaterThan(field.width);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
      }));
      expect(overflow, `no scrolling on the ${screen} screen`).toEqual({ x: 0, y: 0 });
    }
  });

  test('every field pixel covers a whole number of device pixels', async ({ game }) => {
    const { width } = await game.fieldSize();
    const devicePixels = await game.canvas.evaluate(
      (c: HTMLCanvasElement) => c.getBoundingClientRect().width * window.devicePixelRatio,
    );
    expect(devicePixels / width).toBeCloseTo(Math.round(devicePixels / width), 2);
  });

  test('the canvas keeps its size from the menu to the round', async ({ game }) => {
    const before = await game.canvas.boundingBox();
    await game.play();
    expect(await game.canvas.boundingBox()).toEqual(before);
  });

  test('the field is as large as the screen allows (no wasted whole step)', async ({
    game,
    page,
  }) => {
    // One more whole device pixel per field pixel must no longer fit; otherwise we left space unused.
    const fits = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const stage = document.querySelector('.stage');
      if (c === null || stage === null) return false;
      const dpr = window.devicePixelRatio;
      const { width, height } = c;
      const nextWidth =
        ((Math.round((c.getBoundingClientRect().width * dpr) / width) + 1) * width) / dpr;
      const nextHeight = (nextWidth * height) / width;
      const frame = stage.getBoundingClientRect().height - c.getBoundingClientRect().height;
      const chrome = document.documentElement.scrollHeight - stage.getBoundingClientRect().height;
      const side = document.querySelector('.hud')?.getBoundingClientRect().right ?? 0;
      const besideField = side <= stage.getBoundingClientRect().left + 1;
      const roomHeight = besideField ? window.innerHeight : window.innerHeight - chrome + frame;
      return (
        nextHeight + frame > roomHeight - 1 || nextWidth + 6 > document.documentElement.clientWidth
      );
    });
    await game.play();
    expect(fits).toBe(true);
  });
});
