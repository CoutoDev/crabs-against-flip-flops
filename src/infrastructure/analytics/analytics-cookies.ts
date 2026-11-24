/** Cookies set by Google Analytics and Tag Manager's Google tags. */
const ANALYTICS_COOKIE = /^(_ga|_gid|_gat|_gcl|_gac)/;

/** The part of `document` this uses, so tests can pass a fake. */
export interface CookieJar {
  cookie: string;
}

/** The host itself and each parent domain: `a.b.c` gives `a.b.c`, `b.c` and `c`. */
export function domainCandidates(hostname: string): string[] {
  const parts = hostname.split('.');
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) result.push(parts.slice(i).join('.'));
  return result;
}

/**
 * Expires the analytics cookies the page can see. They may belong to the host or to a parent
 * domain (the browser refuses a domain we may not write to, which is harmless), so each one is
 * expired for every candidate. Other cookies are left alone.
 */
export function deleteAnalyticsCookies(jar: CookieJar, hostname: string): void {
  const names = jar.cookie
    .split(';')
    .map((pair) => pair.split('=')[0]?.trim() ?? '')
    .filter((name) => ANALYTICS_COOKIE.test(name));
  const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  for (const name of names) {
    jar.cookie = `${name}=; ${expired}`;
    for (const domain of domainCandidates(hostname)) {
      jar.cookie = `${name}=; ${expired}; domain=${domain}`;
    }
  }
}
