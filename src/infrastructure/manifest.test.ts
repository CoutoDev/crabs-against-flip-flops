import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8')) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

describe('web app manifest', () => {
  it('names the app and starts it relative to where it is hosted (GitHub Pages sub-path)', () => {
    expect(manifest.name).toBe('Crabs Against Flip Flops');
    expect(manifest.short_name.length).toBeLessThanOrEqual(20);
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
  });

  it('uses the colors of the game', () => {
    expect(manifest.theme_color).toBe('#14213d');
    expect(manifest.background_color).toBe('#14213d');
  });

  it('lists icons that exist, with the sizes and purposes installers ask for', () => {
    const purposes = new Set(manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`));
    expect(purposes).toContain('192x192:any');
    expect(purposes).toContain('512x512:any');
    expect(purposes).toContain('512x512:maskable');
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(existsSync(new URL(`public/${icon.src}`, root)), icon.src).toBe(true);
    }
  });

  it('is linked from the page, with the icons and the theme color', () => {
    const html = readFileSync(new URL('index.html', root), 'utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="theme-color" content="#14213d"');
  });
});
