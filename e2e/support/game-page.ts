import { expect, type Locator, type Page } from '@playwright/test';

export type ScreenName = 'menu' | 'playing' | 'paused' | 'ended';

interface Point {
  readonly x: number;
  readonly y: number;
}

/** The view alternates this invisible character so identical announcements are re-read. */
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

/** Crab body color (palette index 10 in src/infrastructure/render/palette.ts). */
const CRAB_RED = [0xc1, 0x35, 0x2b] as const;
/** Mirrors the level's throw model closely enough to lead a moving target. */
const THROW_SPEED_PX_PER_SEC = 240;

/**
 * Page object for the game: every selector and every canvas trick lives here, so specs read as
 * player intent and a markup change touches one file.
 */
export class GamePage {
  readonly stage: Locator;
  readonly canvas: Locator;
  readonly live: Locator;
  /** Console and page errors seen since `open()`; specs assert it is empty. */
  problems: string[] = [];

  constructor(readonly page: Page) {
    this.stage = page.locator('.stage');
    this.canvas = page.locator('canvas');
    this.live = page.locator('[role="status"]');
  }

  /** Opens the game with a spy on the Web Audio API and fails the test on any page error. */
  async open(): Promise<void> {
    await this.page.addInitScript(() => {
      const spy = { contexts: 0, oscillators: 0 };
      Object.defineProperty(window, '__audioSpy', { value: spy });
      const Original = window.AudioContext;
      window.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          spy.contexts++;
        }
        override createOscillator(): OscillatorNode {
          spy.oscillators++;
          return super.createOscillator();
        }
      };
    });
    const problems: string[] = [];
    this.page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    this.page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });
    this.problems = problems;
    await this.page.goto('./');
    await expect(this.canvas).toBeVisible();
  }

  async expectScreen(name: ScreenName): Promise<void> {
    await expect(this.stage).toHaveAttribute('data-screen', name);
  }

  overlay(name: Exclude<ScreenName, 'playing'>): Locator {
    return this.page.locator(`[data-overlay="${name}"]`);
  }

  /** The visible dialog's main button, whatever the language. */
  primaryButton(): Locator {
    return this.page.locator('.overlay:not([hidden]) .control--primary');
  }

  async play(): Promise<void> {
    await this.primaryButton().click();
    await this.expectScreen('playing');
  }

  hud(item: 'level' | 'score' | 'ammo' | 'combo'): Locator {
    return this.page.locator(`.hud__item--${item} .hud__value`);
  }

  async ammo(): Promise<number> {
    return Number(await this.hud('ammo').innerText());
  }

  async score(): Promise<number> {
    return Number((await this.hud('score').innerText()).split('/')[0]?.replace(/\D/g, ''));
  }

  async liveText(): Promise<string> {
    return (await this.live.textContent())?.replaceAll(ZERO_WIDTH_SPACE, '') ?? '';
  }

  async audioSpy(): Promise<{ contexts: number; oscillators: number }> {
    return this.page.evaluate(
      () =>
        (window as unknown as { __audioSpy: { contexts: number; oscillators: number } }).__audioSpy,
    );
  }

  /** The logical field size (180×320), read from the canvas itself so specs never hard-code it. */
  async fieldSize(): Promise<{ width: number; height: number }> {
    return this.canvas.evaluate((c: HTMLCanvasElement) => ({ width: c.width, height: c.height }));
  }

  /** Clicks (or taps, on a touch project) a point given in field pixels. */
  async throwAt(point: Point, mode: 'mouse' | 'touch' = 'mouse'): Promise<void> {
    const box = await this.canvas.boundingBox();
    const field = await this.fieldSize();
    if (box === null) throw new Error('canvas has no box');
    const x = box.x + (point.x / field.width) * box.width;
    const y = box.y + (point.y / field.height) * box.height;
    if (mode === 'touch') await this.page.touchscreen.tap(x, y);
    else await this.page.mouse.click(x, y);
  }

  /** Center of the first crab found by looking at the real pixels the player sees. */
  async findCrab(): Promise<Point | undefined> {
    return this.canvas.evaluate((c: HTMLCanvasElement, [r, g, b]) => {
      const { width, height } = c;
      const data = c.getContext('2d')?.getImageData(0, 0, width, height).data;
      if (data === undefined) return undefined;
      const hits: [number, number][] = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i] === r && data[i + 1] === g && data[i + 2] === b) hits.push([x, y]);
        }
      }
      const first = hits[0];
      if (first === undefined) return undefined;
      const body = hits.filter(
        ([x, y]) => Math.abs(x - first[0]) < 14 && Math.abs(y - first[1]) < 14,
      );
      const sum = body.reduce<[number, number]>((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
      return { x: sum[0] / body.length, y: sum[1] / body.length };
    }, CRAB_RED);
  }

  /**
   * Plays a whole round like a person would: watches the screen, leads the crab and clicks.
   * Returns how many throws it made and the best score it saw.
   */
  async playRoundWithBot(maxThrows = 40): Promise<{ throws: number; bestScore: number }> {
    const field = await this.fieldSize();
    const origin = { x: field.width / 2, y: field.height - 8 };
    const sampleMs = 120;
    let throws = 0;
    let bestScore = 0;
    while ((await this.stage.getAttribute('data-screen')) === 'playing' && throws < maxThrows) {
      const before = await this.findCrab();
      await this.page.waitForTimeout(sampleMs);
      const after = await this.findCrab();
      if (before === undefined || after === undefined || Math.abs(after.x - before.x) > 12)
        continue;
      if ((await this.ammo()) === 0) continue;
      const seconds = sampleMs / 1000;
      const vx = (after.x - before.x) / seconds;
      const vy = (after.y - before.y) / seconds;
      const flightSeconds = Math.min(
        0.8,
        Math.max(0.35, Math.hypot(after.x - origin.x, after.y - origin.y) / THROW_SPEED_PX_PER_SEC),
      );
      await this.throwAt({
        x: Math.min(field.width - 1, Math.max(0, after.x + vx * flightSeconds)),
        y: Math.min(field.height - 1, Math.max(0, after.y + vy * flightSeconds)),
      });
      throws++;
      await this.page.waitForTimeout(flightSeconds * 1000 + 120);
      bestScore = Math.max(bestScore, await this.score());
    }
    return { throws, bestScore };
  }
}
