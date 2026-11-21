import { defineConfig } from '@playwright/test';

const PORT = 4173;

/**
 * Sandboxed machines often cannot download Playwright's browser. Point PW_CHROME_PATH to an installed
 * Chrome/Chromium to use it instead (`--no-sandbox` is added only in that opt-in case, because such
 * environments usually run as root). CI installs the browser with `npx playwright install`.
 */
const chromePath = process.env['PW_CHROME_PATH'];
const launchOptions = chromePath ? { executablePath: chromePath, args: ['--no-sandbox'] } : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  // The production build, served as static files like GitHub Pages does (not the dev server).
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /(touch|landscape)\.spec\.ts/,
      use: { viewport: { width: 1280, height: 800 }, locale: 'en-US' },
    },
    {
      // A phone held upright: the layout this game is designed around.
      name: 'phone',
      testMatch: /(layout|touch)\.spec\.ts/,
      use: {
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: 'pt-BR',
      },
    },
    {
      name: 'phone-landscape',
      testMatch: /layout\.spec\.ts/,
      use: {
        viewport: { width: 740, height: 360 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: 'pt-BR',
      },
    },
  ],
});
