import { GtmAnalytics } from './gtm-analytics';
import { deleteAnalyticsCookies } from './analytics-cookies';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Tag Manager wired to the real page. */
export function createBrowserAnalytics(containerId: string): GtmAnalytics {
  window.dataLayer = window.dataLayer ?? [];
  return new GtmAnalytics({
    containerId,
    dataLayer: window.dataLayer,
    loadScript: (src) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = src;
      document.head.append(script);
    },
    clearCookies: () => deleteAnalyticsCookies(document, window.location.hostname),
    now: () => Date.now(),
  });
}

/** True when the browser sends "Global Privacy Control" (do not sell or share my data). */
export function privacySignalOn(): boolean {
  return (
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}
