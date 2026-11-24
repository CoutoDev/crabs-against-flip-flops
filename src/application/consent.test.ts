import { describe, expect, it, vi } from 'vitest';
import { Consent, CONSENT_MAX_AGE_MS, CONSENT_VERSION, parseConsent } from './consent';
import type { ConsentRecord, ConsentStore } from './ports/consent-store';

const NOW = 1_700_000_000_000;

function setup(stored?: unknown, privacySignal = false, now = NOW) {
  const store: ConsentStore & { saved: ConsentRecord[] } = {
    saved: [],
    load: () => stored,
    save(record) {
      this.saved.push(record);
    },
  };
  const consent = new Consent({ store, now: () => now, privacySignal });
  return { consent, store };
}

const record = (analytics: boolean, decidedAt = NOW - 1000): ConsentRecord => ({
  version: CONSENT_VERSION,
  analytics,
  decidedAt,
});

describe('parseConsent', () => {
  it('accepts a well-formed record', () => {
    expect(parseConsent(record(true))).toEqual(record(true));
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['text', 'granted'],
    ['an old version', { ...record(true), version: CONSENT_VERSION - 1 }],
    ['a non-boolean choice', { ...record(true), analytics: 'yes' }],
    ['a missing date', { version: CONSENT_VERSION, analytics: true }],
    ['a date that is not a number', { ...record(true), decidedAt: 'yesterday' }],
    ['an infinite date', { ...record(true), decidedAt: Infinity }],
  ])('rejects %s', (_label, raw) => {
    expect(parseConsent(raw)).toBeUndefined();
  });
});

describe('Consent', () => {
  it('asks first: nothing is measured before the player chooses', () => {
    const { consent } = setup();
    expect(consent.status).toBe('unset');
    expect(consent.needsPrompt).toBe(true);
  });

  it('remembers a stored choice, either way', () => {
    expect(setup(record(true)).consent.status).toBe('granted');
    expect(setup(record(false)).consent.status).toBe('denied');
    expect(setup(record(true)).consent.needsPrompt).toBe(false);
  });

  it('asks again after a year, and when the date makes no sense', () => {
    expect(setup(record(true, NOW - CONSENT_MAX_AGE_MS + 1)).consent.status).toBe('granted');
    expect(setup(record(true, NOW - CONSENT_MAX_AGE_MS)).consent.status).toBe('unset');
    expect(setup(record(true, NOW + 60_000)).consent.status).toBe('unset');
  });

  it('asks again when the stored record is damaged or from another version', () => {
    expect(setup('{ broken').consent.status).toBe('unset');
    expect(setup({ ...record(true), version: 0 }).consent.status).toBe('unset');
  });

  it('accept and reject store the choice with the time of the decision', () => {
    const { consent, store } = setup();
    consent.accept();
    expect(consent.status).toBe('granted');
    consent.reject();
    expect(consent.status).toBe('denied');
    expect(store.saved).toEqual([
      { version: CONSENT_VERSION, analytics: true, decidedAt: NOW },
      { version: CONSENT_VERSION, analytics: false, decidedAt: NOW },
    ]);
  });

  it('tells the listeners only when the status really changes', () => {
    const { consent } = setup();
    const listener = vi.fn();
    const off = consent.onChange(listener);
    consent.accept();
    consent.accept();
    expect(listener).toHaveBeenCalledTimes(1);
    consent.reject();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    consent.accept();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  describe('with the browser privacy signal (Global Privacy Control)', () => {
    it('counts as a refusal and does not ask', () => {
      const { consent } = setup(undefined, true);
      expect(consent.status).toBe('denied');
      expect(consent.needsPrompt).toBe(false);
      expect(consent.blockedBySignal).toBe(true);
    });

    it('does not override a choice the player made on purpose', () => {
      const { consent } = setup(record(true), true);
      expect(consent.status).toBe('granted');
      expect(consent.blockedBySignal).toBe(false);
    });

    it('lets the player opt in knowingly', () => {
      const { consent } = setup(undefined, true);
      const listener = vi.fn();
      consent.onChange(listener);
      consent.accept();
      expect(consent.status).toBe('granted');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
