/**
 * Deterministic pseudo-random source. The domain never calls Math.random: the composition root
 * picks a seed, and everything else is a pure function of that seed (replayable, testable).
 */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Internal 32-bit state; feeding it back to `createRng` resumes the exact same sequence. */
  readonly state: number;
}

/** mulberry32: tiny, fast, good enough for gameplay randomness (not for security). */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return s;
    },
  };
}

/** Float in [min, max). Always consumes exactly one draw. */
export function between(rng: Rng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

/** Weighted pick. Always consumes exactly one draw (so draw counts stay predictable). */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T {
  let total = 0;
  for (const item of items) total += weightOf(item);
  let roll = rng.next() * total;
  for (const item of items) {
    const weight = weightOf(item);
    if (roll < weight) return item;
    roll -= weight;
  }
  const last = items.at(-1);
  if (last === undefined) throw new RangeError('pickWeighted: empty list');
  return last;
}
