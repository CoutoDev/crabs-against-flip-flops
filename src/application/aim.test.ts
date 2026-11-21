import { describe, expect, it } from 'vitest';
import { AIM_FAST_STEP_PX, AIM_STEP_PX, DEFAULT_AIM, moveAim } from './aim';

describe('moveAim', () => {
  it('moves by the given step in each direction', () => {
    expect(moveAim({ x: 100, y: 100 }, 1, 0, AIM_STEP_PX)).toEqual({ x: 108, y: 100 });
    expect(moveAim({ x: 100, y: 100 }, -1, 0, AIM_STEP_PX)).toEqual({ x: 92, y: 100 });
    expect(moveAim({ x: 100, y: 100 }, 0, 1, AIM_STEP_PX)).toEqual({ x: 100, y: 108 });
    expect(moveAim({ x: 100, y: 100 }, 0, -1, AIM_FAST_STEP_PX)).toEqual({ x: 100, y: 76 });
  });

  it('supports diagonals', () => {
    expect(moveAim({ x: 100, y: 100 }, 1, -1, AIM_STEP_PX)).toEqual({ x: 108, y: 92 });
  });

  it('stays inside the field', () => {
    expect(moveAim({ x: 2, y: 2 }, -1, -1, AIM_STEP_PX)).toEqual({ x: 0, y: 0 });
    expect(moveAim({ x: 318, y: 178 }, 1, 1, AIM_STEP_PX)).toEqual({ x: 320, y: 180 });
  });

  it('starts at a sensible spot over the beach', () => {
    expect(DEFAULT_AIM.x).toBe(160);
    expect(DEFAULT_AIM.y).toBeGreaterThan(80);
    expect(DEFAULT_AIM.y).toBeLessThan(150);
  });
});
