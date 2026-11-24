import type { AnalyticsEvent, AnalyticsPort } from '../../application/analytics';

export interface GtmDeps {
  /** The container id, like `GTM-XXXXXXX`. */
  readonly containerId: string;
  /** The page's `dataLayer` array (created by the adapter if the page has none). */
  readonly dataLayer: unknown[];
  /** Adds the container script to the page. */
  readonly loadScript: (src: string) => void;
  /** Expires the analytics cookies (when the player withdraws consent). */
  readonly clearCookies: () => void;
  readonly now: () => number;
}

/** Consent Mode v2 signals. Only analytics can ever be granted: the game shows no ads. */
const DENIED = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
} as const;

/**
 * Google Tag Manager behind the analytics port, with Consent Mode v2:
 * - Consent defaults to denied, and the container is not even downloaded until the player accepts
 *   (so nothing, not even the page address, goes to Google before that).
 * - Events are pushed to the data layer only while consent is granted, and are never kept for later.
 * - Withdrawing consent stops the events and removes the cookies; a container that was already
 *   loaded cannot be unloaded, which is why `setConsent` tells the caller (it reloads the page).
 */
export class GtmAnalytics implements AnalyticsPort {
  private granted = false;
  private containerLoaded = false;

  constructor(private readonly deps: GtmDeps) {
    this.gtag('consent', 'default', DENIED);
  }

  /** True when the Tag Manager container was loaded in this visit. */
  get loaded(): boolean {
    return this.containerLoaded;
  }

  /** Follows the player's choice. Safe to call with the same value again. */
  setConsent(granted: boolean): void {
    if (granted === this.granted) return;
    this.granted = granted;
    if (granted) {
      this.gtag('consent', 'update', { analytics_storage: 'granted' });
      if (!this.containerLoaded) {
        this.containerLoaded = true;
        this.deps.dataLayer.push({ 'gtm.start': this.deps.now(), event: 'gtm.js' });
        this.deps.loadScript(
          `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(this.deps.containerId)}`,
        );
      }
    } else {
      this.gtag('consent', 'update', { analytics_storage: 'denied' });
      this.deps.clearCookies();
    }
  }

  track(event: AnalyticsEvent): void {
    if (!this.granted) return;
    this.deps.dataLayer.push({ event: event.name, ...event.params });
  }

  /**
   * Tag Manager reads consent commands only when they are pushed as an `arguments` object, which
   * is what the standard `gtag()` does; an array would be silently ignored.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- read through `arguments`, like gtag()
  private gtag(..._command: unknown[]): void {
    // eslint-disable-next-line prefer-rest-params
    this.deps.dataLayer.push(arguments);
  }
}
