import type { ConsentRecord, ConsentStore } from './ports/consent-store';

/** Bump it when the purposes change (new tools, new kinds of data): everyone is asked again. */
export const CONSENT_VERSION = 1;

/** A decision is asked again after a year, as regulators recommend. */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * `granted` and `denied` are choices (the player's, or the browser's privacy signal); `unset`
 * means we still have to ask. Nothing is measured unless the status is `granted`.
 */
export type ConsentStatus = 'granted' | 'denied' | 'unset';

export interface ConsentDeps {
  readonly store: ConsentStore;
  /** Impure on purpose (Date.now is forbidden here): the composition root provides the time. */
  readonly now: () => number;
  /**
   * The browser sent a "do not sell or share" signal (Global Privacy Control). It counts as a
   * refusal when the player has not chosen anything themselves, and the banner is not shown.
   */
  readonly privacySignal: boolean;
}

/** Validates what was read from the store: anything unexpected means "never decided". */
export function parseConsent(raw: unknown): ConsentRecord | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { version, analytics, decidedAt } = raw as Record<string, unknown>;
  if (version !== CONSENT_VERSION) return undefined;
  if (typeof analytics !== 'boolean') return undefined;
  if (typeof decidedAt !== 'number' || !Number.isFinite(decidedAt)) return undefined;
  return { version, analytics, decidedAt };
}

/**
 * The player's choice about analytics. Opt-in everywhere: the site is static, so it cannot tell
 * where a visitor is, and asking first is the strictest rule (GDPR, LGPD, Quebec's Law 25) and
 * more than the US state laws ask for. The Global Privacy Control signal is honored as a refusal.
 */
export class Consent {
  private record: ConsentRecord | undefined;
  private listeners: readonly (() => void)[] = [];

  constructor(private readonly deps: ConsentDeps) {
    const stored = parseConsent(deps.store.load());
    const age = stored === undefined ? 0 : deps.now() - stored.decidedAt;
    // A decision dated in the future (clock changed) is not trusted either.
    this.record = stored !== undefined && age >= 0 && age < CONSENT_MAX_AGE_MS ? stored : undefined;
  }

  get status(): ConsentStatus {
    if (this.record !== undefined) return this.record.analytics ? 'granted' : 'denied';
    return this.deps.privacySignal ? 'denied' : 'unset';
  }

  /** True while the banner must be shown on its own (first visit, expired or outdated choice). */
  get needsPrompt(): boolean {
    return this.status === 'unset';
  }

  /** True when the browser's privacy signal is what keeps analytics off. */
  get blockedBySignal(): boolean {
    return this.record === undefined && this.deps.privacySignal;
  }

  accept(): void {
    this.decide(true);
  }

  reject(): void {
    this.decide(false);
  }

  /** Returns the unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  private decide(analytics: boolean): void {
    const before = this.status;
    this.record = { version: CONSENT_VERSION, analytics, decidedAt: this.deps.now() };
    this.deps.store.save(this.record);
    if (this.status !== before) for (const listener of this.listeners) listener();
  }
}
