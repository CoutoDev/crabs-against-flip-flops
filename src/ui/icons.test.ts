import { describe, expect, it } from 'vitest';
import { ICON_ROWS, pathFor } from './icons';

describe('pixel icons', () => {
  it.each(Object.entries(ICON_ROWS))('%s is a clean rectangle of pixels', (_name, rows) => {
    const width = rows[0]?.length ?? 0;
    expect(width).toBeGreaterThan(0);
    for (const row of rows) expect(row).toMatch(new RegExp(`^[.X]{${width}}$`));
    expect(rows.some((row) => row.includes('X'))).toBe(true);
  });

  it('draws one rectangle per run of pixels', () => {
    expect(pathFor(['XX.X', '....', '.XXX'])).toBe('M0 0h2v1h-2zM3 0h1v1h-1zM1 2h3v1h-3z');
  });
});
