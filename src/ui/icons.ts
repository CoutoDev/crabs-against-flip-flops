/**
 * Small pixel-art icons for the buttons, in the same 8-bit spirit as the field. Each icon is a map
 * of pixels ("X" = filled) turned into one SVG path, so they stay sharp at any size, take the
 * text color (`currentColor`) and need no image files.
 */
const ICON_MAPS = {
  speaker: [
    '............',
    '.....X...X..',
    '....XX....X.',
    '...XXX.X..X.',
    'XXXXXX..X.X.',
    'XXXXXX..X.X.',
    'XXXXXX..X.X.',
    'XXXXXX..X.X.',
    '...XXX.X..X.',
    '....XX....X.',
    '.....X...X..',
    '............',
  ],
  speakerOff: [
    '............',
    '.....X......',
    '....XX......',
    '...XXX..X..X',
    'XXXXXX...XX.',
    'XXXXXX...XX.',
    'XXXXXX...XX.',
    'XXXXXX...XX.',
    '...XXX..X..X',
    '....XX......',
    '.....X......',
    '............',
  ],
  music: [
    '....XXXXXXXX',
    '....XXXXXXXX',
    '....XX....XX',
    '....XX....XX',
    '....XX....XX',
    '....XX....XX',
    '..XXXX..XXXX',
    '.XXXXX.XXXXX',
    '.XXXXX.XXXXX',
    '..XXX...XXX.',
  ],
  globe: [
    '..XXXXXXXX..',
    '.XX.XXXX.XX.',
    'XX..X..X..XX',
    'X...X..X...X',
    'XXXXXXXXXXXX',
    'X...X..X...X',
    'X...X..X...X',
    'XXXXXXXXXXXX',
    'X...X..X...X',
    'XX..X..X..XX',
    '.XX.XXXX.XX.',
    '..XXXXXXXX..',
  ],
  cart: [
    'XXX.........',
    '..X.........',
    '..X.XXXXXXXX',
    '..X.XXXXXXXX',
    '..XXXXXXXXX.',
    '...XXXXXXXX.',
    '...XXXXXXX..',
    '....XXXXXX..',
    '...XX..XX...',
    '...XX..XX...',
  ],
  back: [
    '....X.......',
    '...XX.......',
    '..XXX.......',
    '.XXXXXXXXXXX',
    'XXXXXXXXXXXX',
    'XXXXXXXXXXXX',
    '.XXXXXXXXXXX',
    '..XXX.......',
    '...XX.......',
    '....X.......',
  ],
  check: [
    '.........XX.',
    '........XXX.',
    '.......XXX..',
    'XX....XXX...',
    'XXX..XXX....',
    '.XXXXXX.....',
    '..XXXX......',
    '...XX.......',
  ],
  play: [
    'XX..........',
    'XXXX........',
    'XXXXXX......',
    'XXXXXXXX....',
    'XXXXXXXXXX..',
    'XXXXXXXXXXXX',
    'XXXXXXXXXX..',
    'XXXXXXXX....',
    'XXXXXX......',
    'XXXX........',
    'XX..........',
  ],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICON_MAPS;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** One path made of a rectangle per horizontal run of filled pixels. */
export function pathFor(rows: readonly string[]): string {
  const parts: string[] = [];
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/X+/g)) {
      parts.push(`M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`);
    }
  });
  return parts.join('');
}

/** A decorative icon (hidden from screen readers: the button's text is its name). */
export function icon(name: IconName): SVGSVGElement {
  const rows: readonly string[] = ICON_MAPS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `icon icon--${name}`);
  svg.setAttribute('viewBox', `0 0 ${rows[0]?.length ?? 0} ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathFor(rows));
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

/** For the tests: every map must be a clean rectangle of pixels. */
export const ICON_ROWS: Readonly<Record<IconName, readonly string[]>> = ICON_MAPS;
