export const CRAB_TYPE_IDS = ['common', 'swimmer', 'fiddler'] as const;

/** common = caranguejo, swimmer = siri (faster), fiddler = violinista (small hit box, more points). */
export type CrabType = (typeof CRAB_TYPE_IDS)[number];

export interface CrabTypeSpec {
  readonly points: number;
  readonly hitRadiusPx: number;
}

export type CrabSpecs = Readonly<Record<CrabType, CrabTypeSpec>>;

export interface Crab {
  readonly id: number;
  readonly type: CrabType;
  /** Center of the crab, in field pixels. */
  readonly x: number;
  readonly y: number;
  /** Crabs walk sideways: +1 = left to right, -1 = right to left. */
  readonly direction: 1 | -1;
  readonly speedPxPerSec: number;
}
