import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { renderAppIcon } from './app-icon';

/**
 * The PNGs in public/ are generated from the game's own sprite. This test keeps them honest:
 * it decodes each committed file and compares it with a fresh render. After changing the art
 * run `UPDATE_ICONS=1 npx vitest run app-icon` to rewrite them.
 */
const SIZES = [192, 512] as const;
const fileFor = (size: number) => new URL(`../../../public/icon-${size}.png`, import.meta.url);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function decodePng(file: Buffer): { width: number; height: number; rgba: Buffer } {
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const chunks: Buffer[] = [];
  for (let at = 8; at < file.length;) {
    const length = file.readUInt32BE(at);
    if (file.toString('ascii', at + 4, at + 8) === 'IDAT')
      chunks.push(file.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw.copy(rgba, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  }
  return { width, height, rgba };
}

describe('app icon', () => {
  it.each(SIZES)('renders at %i px with every pixel painted', (size) => {
    const icon = renderAppIcon(size);
    expect([icon.width, icon.height]).toEqual([size, size]);
    for (let i = 3; i < icon.data.length; i += 4) expect(icon.data[i]).toBe(255);
  });

  it('refuses a size that would blur the pixel art', () => {
    expect(() => renderAppIcon(100)).toThrow(RangeError);
  });

  it.each(SIZES)('the committed icon-%i.png is what the game would draw', (size) => {
    const fresh = renderAppIcon(size);
    if (process.env['UPDATE_ICONS'] === '1') {
      writeFileSync(fileFor(size), encodePng(size, size, fresh.data));
    }
    const decoded = decodePng(readFileSync(fileFor(size)));
    expect([decoded.width, decoded.height]).toEqual([size, size]);
    expect(Buffer.compare(decoded.rgba, Buffer.from(fresh.data))).toBe(0);
  });
});
