import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/fixtures';

const GTM = 'https://www.googletagmanager.com/gtm.js?id=GTM-MCWMM5C6';
const CONSENT_KEY = 'crabs-against-flip-flops:consent';

test.describe('first visit', () => {
  test.use({ consent: 'unset' });

  test('asks before anything is measured, and nothing behind the dialog can be reached', async ({
    game,
    page,
  }) => {
    await expect(game.consentDialog()).toBeVisible();
    await expect(game.consentDialog()).toBeFocused();
    await expect(game.consentDialog().getByRole('heading')).toHaveText('Your privacy');
    await expect(game.overlay('menu')).toHaveAttribute('inert', '');
    await expect(game.canvas).toHaveAttribute('inert', '');
    expect(game.analyticsRequests, 'not even the container is downloaded').toEqual([]);
    expect(await game.dataLayer()).toHaveLength(1);
    expect(await game.events('level_start')).toEqual([]);
    // Tabbing never lands on anything behind the dialog (after its last button the browser's own
    // controls take the focus, which is the normal way out of a modal).
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const behind = await page.evaluate(() => {
        const active = document.activeElement;
        return (
          active !== null && active !== document.body && !active.closest('[data-overlay="consent"]')
        );
      });
      expect(behind, `focus after Tab #${i + 1} is on something behind the dialog`).toBe(false);
    }
  });

  test('Accept and Reject are twins: same size, side by side', async ({ game }) => {
    const accept = await game.consentDialog().getByRole('button', { name: 'Accept' }).boundingBox();
    const reject = await game.consentDialog().getByRole('button', { name: 'Reject' }).boundingBox();
    expect(accept).not.toBeNull();
    expect(reject).not.toBeNull();
    expect(accept?.width).toBeCloseTo(reject?.width ?? 0, 0);
    expect(accept?.height).toBeCloseTo(reject?.height ?? 0, 0);
    expect(accept?.y).toBeCloseTo(reject?.y ?? 0, 0);
    expect(game.consentDialog().getByRole('button', { name: 'Cancel' })).toBeHidden();
  });

  test('Accept starts Tag Manager once, grants only analytics, and is remembered', async ({
    game,
    page,
  }) => {
    await game.consentDialog().getByRole('button', { name: 'Accept' }).click();
    await expect(game.consentDialog()).toBeHidden();
    await expect(game.primaryButton()).toBeFocused();
    await expect.poll(() => game.analyticsRequests).toEqual([GTM]);
    const layer = await game.dataLayer();
    expect(layer.slice(1, 3)).toEqual([
      ['consent', 'update', { analytics_storage: 'granted' }],
      expect.objectContaining({ event: 'gtm.js' }),
    ]);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY);
    expect(JSON.parse(stored ?? 'null')).toMatchObject({ version: 1, analytics: true });

    await game.reload();
    await expect(game.consentDialog()).toBeHidden();
    await expect.poll(() => game.analyticsRequests.length).toBe(2); // once per visit
  });

  test('Reject loads nothing and is remembered', async ({ game, page }) => {
    await game.consentDialog().getByRole('button', { name: 'Reject' }).click();
    await expect(game.consentDialog()).toBeHidden();
    await expect(game.primaryButton()).toBeFocused();
    await game.play();
    expect(game.analyticsRequests).toEqual([]);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY);
    expect(JSON.parse(stored ?? 'null')).toMatchObject({ analytics: false });
    await game.reload();
    await expect(game.consentDialog()).toBeHidden();
    expect(game.analyticsRequests).toEqual([]);
  });

  test('the details open and explain what is collected', async ({ game }) => {
    await game.consentDialog().getByText('More details').click();
    await expect(game.consentDialog()).toContainText('Never your name');
    await expect(game.consentDialog()).toContainText('Cookies');
  });

  test('has no accessibility violations, in English and in Portuguese', async ({ game, page }) => {
    const check = async () =>
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations.map((v) => `${v.id}: ${v.help}`);
    expect(await check()).toEqual([]);
    await game.consentDialog().getByText('More details').click();
    expect(await check()).toEqual([]);
  });
});

test.describe('first visit in Portuguese', () => {
  test.use({ consent: 'unset', locale: 'pt-BR' });

  test('speaks Portuguese and passes axe', async ({ game, page }) => {
    await expect(game.consentDialog().getByRole('heading')).toHaveText('Sua privacidade');
    await expect(game.consentDialog().getByRole('button', { name: 'Aceitar' })).toBeVisible();
    await expect(game.consentDialog().getByRole('button', { name: 'Recusar' })).toBeVisible();
    const violations = (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations.map((v) => `${v.id}: ${v.help}`);
    expect(violations).toEqual([]);
  });
});

test.describe('browser privacy signal (Global Privacy Control)', () => {
  test.use({ consent: 'unset', privacySignal: true });

  test('counts as a refusal: no banner, nothing loaded', async ({ game }) => {
    await game.expectScreen('menu');
    await expect(game.consentDialog()).toBeHidden();
    await expect(game.primaryButton()).toBeFocused();
    await game.play();
    expect(game.analyticsRequests).toEqual([]);
  });

  test('the player can still opt in on purpose, and is told why it was off', async ({
    game,
    page,
  }) => {
    await page.getByRole('button', { name: 'Privacy choices' }).click();
    await expect(game.consentDialog()).toContainText('Global Privacy Control');
    await game.consentDialog().getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => game.analyticsRequests).toEqual([GTM]);
  });
});

test.describe('changing your mind', () => {
  test('"Privacy choices" reopens the dialog with a Cancel, Esc and the current choice', async ({
    game,
    page,
  }) => {
    const entry = page.getByRole('button', { name: 'Privacy choices' });
    await entry.click();
    await expect(game.consentDialog()).toBeVisible();
    await expect(game.consentDialog()).toContainText('Right now: not allowed');
    await expect(game.consentDialog().getByRole('button', { name: 'Cancel' })).toBeVisible();

    await game.consentDialog().getByRole('button', { name: 'Cancel' }).click();
    await expect(game.consentDialog()).toBeHidden();
    await expect(entry).toBeFocused();

    await entry.click();
    await page.keyboard.press('Escape');
    await expect(game.consentDialog()).toBeHidden();
    expect(game.analyticsRequests).toEqual([]);
  });

  test('accepting later starts Tag Manager without a reload', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Privacy choices' }).click();
    await game.consentDialog().getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => game.analyticsRequests).toEqual([GTM]);
    await game.play();
    expect(await game.events('level_start')).toHaveLength(1);
  });

  test.describe('after accepting', () => {
    test.use({ consent: 'granted' });

    test('rejecting removes the Google cookies and reloads without Tag Manager', async ({
      game,
      page,
    }) => {
      await expect.poll(() => game.analyticsRequests.length).toBe(1);
      await page.evaluate(() => {
        document.cookie = '_ga=GA1.1.123; path=/';
        document.cookie = 'keep=1; path=/';
      });
      await page.getByRole('button', { name: 'Privacy choices' }).click();
      await expect(game.consentDialog()).toContainText('Right now: allowed');

      const reloaded = page.waitForEvent('load');
      await game.consentDialog().getByRole('button', { name: 'Reject' }).click();
      await reloaded;
      await expect(game.canvas).toBeVisible();

      const cookies = await page.evaluate(() => document.cookie);
      expect(cookies).not.toContain('_ga');
      expect(cookies).toContain('keep=1');
      await expect(game.consentDialog()).toBeHidden();
      expect(game.analyticsRequests.length, 'no new request after the reload').toBe(1);
      expect(await game.events('level_start')).toEqual([]);
    });
  });
});
