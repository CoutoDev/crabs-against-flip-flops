import { describe, expect, it } from 'vitest';
import { MIN_ANIMATION_INTERVAL_MS, RepaintGate, type RepaintInputs } from './repaint-gate';

const state = { id: 'state' };
const still = (overrides: Partial<RepaintInputs> = {}): RepaintInputs => ({
  state,
  animating: false,
  aim: undefined,
  view: 'playing|0',
  ...overrides,
});

describe('RepaintGate', () => {
  it('paints the first frame', () => {
    expect(new RepaintGate().shouldRepaint(16, still())).toBe(16);
  });

  it('does not paint again while nothing changed (menu, pause, end screen)', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16, still());
    for (let i = 0; i < 100; i += 1) expect(gate.shouldRepaint(16, still())).toBeUndefined();
  });

  it('paints when the round state changes (a step, a throw)', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16, still());
    expect(gate.shouldRepaint(16, still({ state: { id: 'next' } }))).toBeDefined();
  });

  it('paints when the screen or level (the view) changes', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16, still());
    expect(gate.shouldRepaint(16, still({ view: 'paused|0' }))).toBeDefined();
    expect(gate.shouldRepaint(16, still({ view: 'paused|1' }))).toBeDefined();
  });

  it('paints when the reticle moves, shows or hides, but not when it stays', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16, still());
    expect(gate.shouldRepaint(16, still({ aim: { x: 10, y: 20 } }))).toBeDefined();
    expect(gate.shouldRepaint(16, still({ aim: { x: 10, y: 20 } }))).toBeUndefined();
    expect(gate.shouldRepaint(16, still({ aim: { x: 11, y: 20 } }))).toBeDefined();
    expect(gate.shouldRepaint(16, still({ aim: undefined }))).toBeDefined();
  });

  it('on a 120 Hz screen paints a running round at most once per simulation step', () => {
    const gate = new RepaintGate();
    let painted = 0;
    let current = { id: 0 };
    for (let frame = 0; frame < 120; frame += 1) {
      // The state is a new object every other frame (60 steps per second, 120 frames per second).
      if (frame % 2 === 0) current = { id: frame };
      if (gate.shouldRepaint(1000 / 120, still({ state: current })) !== undefined) painted += 1;
    }
    expect(painted).toBe(60);
  });

  it('keeps a steady pace for animations, not a frame per display frame', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(8, still());
    let painted = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      if (gate.shouldRepaint(1000 / 120, still({ animating: true })) !== undefined) painted += 1;
    }
    expect(painted).toBeLessThanOrEqual(62);
    expect(painted).toBeGreaterThanOrEqual(55);
  });

  it('paints every frame of an animation on a 60 Hz screen', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16.7, still());
    for (let frame = 0; frame < 30; frame += 1) {
      expect(gate.shouldRepaint(16.7, still({ animating: true }))).toBeDefined();
    }
  });

  it('reports how long it has been since the last paint, so effects age correctly', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16, still());
    expect(gate.shouldRepaint(5, still({ animating: true }))).toBeUndefined();
    expect(gate.shouldRepaint(5, still({ animating: true }))).toBeUndefined();
    const elapsed = gate.shouldRepaint(6, still({ animating: true }));
    expect(elapsed).toBe(16);
    expect(elapsed).toBeGreaterThanOrEqual(MIN_ANIMATION_INTERVAL_MS);
  });

  it('ignores negative frame times', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16, still());
    expect(gate.shouldRepaint(-50, still({ state: { id: 2 } }))).toBe(0);
  });

  it('invalidate() forces one more paint', () => {
    const gate = new RepaintGate();
    gate.shouldRepaint(16, still());
    expect(gate.shouldRepaint(16, still())).toBeUndefined();
    gate.invalidate();
    expect(gate.shouldRepaint(16, still())).toBeDefined();
    expect(gate.shouldRepaint(16, still())).toBeUndefined();
  });
});
