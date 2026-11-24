import { describe, expect, it, vi } from 'vitest';
import { GtmAnalytics } from './gtm-analytics';

function setup() {
  const dataLayer: unknown[] = [];
  const loadScript = vi.fn();
  const clearCookies = vi.fn();
  const gtm = new GtmAnalytics({
    containerId: 'GTM-TEST123',
    dataLayer,
    loadScript,
    clearCookies,
    now: () => 42,
  });
  /** What the data layer holds, with `arguments` objects (gtag commands) turned into arrays. */
  const entries = () => dataLayer.map((entry) => (isArguments(entry) ? [...entry] : entry));
  return { gtm, dataLayer, loadScript, clearCookies, entries };
}

const isArguments = (value: unknown): value is ArrayLike<unknown> & Iterable<unknown> =>
  Object.prototype.toString.call(value) === '[object Arguments]';

const DENIED_DEFAULT = [
  'consent',
  'default',
  {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  },
];

describe('GtmAnalytics', () => {
  it('starts with consent denied for everything, pushed as a gtag arguments object', () => {
    const { dataLayer, entries, loadScript } = setup();
    expect(isArguments(dataLayer[0])).toBe(true);
    expect(entries()).toEqual([DENIED_DEFAULT]);
    expect(loadScript).not.toHaveBeenCalled();
  });

  it('sends and loads nothing until consent is granted', () => {
    const { gtm, entries, loadScript } = setup();
    gtm.track({ name: 'game_pause', params: { level_id: 1 } });
    expect(entries()).toEqual([DENIED_DEFAULT]);
    expect(loadScript).not.toHaveBeenCalled();
    expect(gtm.loaded).toBe(false);
  });

  it('on accept: grants only analytics, then starts the container, in that order', () => {
    const { gtm, entries, loadScript } = setup();
    gtm.setConsent(true);
    expect(entries()).toEqual([
      DENIED_DEFAULT,
      ['consent', 'update', { analytics_storage: 'granted' }],
      { 'gtm.start': 42, event: 'gtm.js' },
    ]);
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(loadScript).toHaveBeenCalledWith(
      'https://www.googletagmanager.com/gtm.js?id=GTM-TEST123',
    );
    expect(gtm.loaded).toBe(true);
  });

  it('pushes events as flat data layer objects once granted', () => {
    const { gtm, entries } = setup();
    gtm.setConsent(true);
    gtm.track({ name: 'level_start', params: { level_id: 3, biome: 'rocks' } });
    expect(entries().at(-1)).toEqual({ event: 'level_start', level_id: 3, biome: 'rocks' });
  });

  it('accepting twice does not load the container twice', () => {
    const { gtm, loadScript } = setup();
    gtm.setConsent(true);
    gtm.setConsent(true);
    expect(loadScript).toHaveBeenCalledTimes(1);
  });

  it('on withdrawal: denies analytics again, clears the cookies and stops the events', () => {
    const { gtm, entries, clearCookies } = setup();
    gtm.setConsent(true);
    gtm.setConsent(false);
    expect(entries().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(clearCookies).toHaveBeenCalledTimes(1);
    const length = entries().length;
    gtm.track({ name: 'game_pause', params: { level_id: 1 } });
    expect(entries()).toHaveLength(length);
    expect(gtm.loaded, 'a loaded container cannot be unloaded: the page must reload').toBe(true);
  });

  it('events from before the choice are never kept for later', () => {
    const { gtm, entries } = setup();
    gtm.track({ name: 'level_start', params: { level_id: 1, biome: 'beach' } });
    gtm.setConsent(true);
    expect(entries().some((entry) => (entry as { event?: string }).event === 'level_start')).toBe(
      false,
    );
  });

  it('a refusal at the start changes nothing and clears nothing', () => {
    const { gtm, entries, clearCookies } = setup();
    gtm.setConsent(false);
    expect(entries()).toEqual([DENIED_DEFAULT]);
    expect(clearCookies).not.toHaveBeenCalled();
  });
});
