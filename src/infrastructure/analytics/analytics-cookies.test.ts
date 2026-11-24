import { describe, expect, it } from 'vitest';
import { deleteAnalyticsCookies, domainCandidates } from './analytics-cookies';

describe('domainCandidates', () => {
  it('lists the host and its parent domains', () => {
    expect(domainCandidates('coutodev.github.io')).toEqual([
      'coutodev.github.io',
      'github.io',
      'io',
    ]);
    expect(domainCandidates('localhost')).toEqual(['localhost']);
  });
});

describe('deleteAnalyticsCookies', () => {
  /** A jar that records every write, with a cookie string like `document.cookie`. */
  function jar(cookie: string) {
    const writes: string[] = [];
    return {
      writes,
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        writes.push(value);
      },
    };
  }

  it('expires the Google cookies for the host and each parent domain, and only those', () => {
    const j = jar('_ga=GA1.1.1; _ga_ABC123=GS1; theme=dark; _gid=x; session=1');
    deleteAnalyticsCookies(j, 'a.example.com');
    const touched = new Set(j.writes.map((write) => write.split('=')[0]));
    expect(touched).toEqual(new Set(['_ga', '_ga_ABC123', '_gid']));
    expect(j.writes.filter((write) => write.startsWith('_ga=')).length).toBe(1 + 3);
    expect(j.writes.some((write) => write.includes('domain=example.com'))).toBe(true);
    expect(j.writes.every((write) => write.includes('expires=Thu, 01 Jan 1970'))).toBe(true);
  });

  it('does nothing when there are no analytics cookies', () => {
    const j = jar('theme=dark');
    deleteAnalyticsCookies(j, 'example.com');
    expect(j.writes).toEqual([]);
  });
});
