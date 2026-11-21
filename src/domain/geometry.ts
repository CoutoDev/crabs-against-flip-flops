export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
