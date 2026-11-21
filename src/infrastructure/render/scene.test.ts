import { describe, expect, it } from 'vitest';
import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from '../../domain/constants';
import { createRound, throwSlipper, type RoundState } from '../../domain/rules/round';
import { makeCrab, makeLevel, TEST_CRAB_SPECS } from '../../domain/test-support';
import { createRng } from '../../domain/rng';
import { Effects } from './effects';
import { Framebuffer } from './framebuffer';
import { COLOR, PALETTE_RGB } from './palette';
import { Scene } from './scene';

const newFrame = () => new Framebuffer(FIELD_WIDTH_PX, FIELD_HEIGHT_PX);
const baseState = (): RoundState =>
  createRound({ level: makeLevel(), crabSpecs: TEST_CRAB_SPECS }, 1);
const withCrabs = (state: RoundState, ...crabs: RoundState['crabs']): RoundState => ({
  ...state,
  crabs,
});

describe('Scene', () => {
  it('is deterministic: same inputs, same pixels', () => {
    const scene = new Scene();
    const state = withCrabs(baseState(), makeCrab({ id: 1, x: 100, y: 100 }));
    const a = newFrame();
    const b = newFrame();
    scene.render(a, { state, effects: new Effects(), aim: { x: 50, y: 50 } });
    scene.render(b, { state, effects: new Effects(), aim: { x: 50, y: 50 } });
    expect(a.data).toEqual(b.data);
  });

  it('paints every pixel (no transparent holes) so the canvas never shows through', () => {
    const scene = new Scene();
    const fb = newFrame();
    scene.render(fb, { state: baseState(), effects: new Effects(), aim: undefined });
    for (let i = 3; i < fb.data.length; i += 4) expect(fb.data[i]).toBe(255);
  });

  it('draws a crab where the simulation says it is', () => {
    const scene = new Scene();
    const empty = newFrame();
    const withCrab = newFrame();
    const options = { effects: new Effects(), aim: undefined };
    scene.render(empty, { ...options, state: baseState() });
    scene.render(withCrab, {
      ...options,
      state: withCrabs(baseState(), makeCrab({ x: 90, y: 200 })),
    });
    expect(withCrab.rgbAt(90, 200)).not.toEqual(empty.rgbAt(90, 200));
    expect(withCrab.rgbAt(10, 200)).toEqual(empty.rgbAt(10, 200)); // far from the crab: untouched
  });

  it('mirrors the crab when it walks the other way', () => {
    const scene = new Scene();
    const right = newFrame();
    const left = newFrame();
    const options = { effects: new Effects(), aim: undefined };
    const crab = makeCrab({ x: 90, y: 200, type: 'fiddler' });
    scene.render(right, { ...options, state: withCrabs(baseState(), { ...crab, direction: 1 }) });
    scene.render(left, { ...options, state: withCrabs(baseState(), { ...crab, direction: -1 }) });
    expect(left.data).not.toEqual(right.data);
  });

  it('draws the reticle only when there is an aim', () => {
    const scene = new Scene();
    const hidden = newFrame();
    const shown = newFrame();
    const options = { effects: new Effects(), state: baseState() };
    scene.render(hidden, { ...options, aim: undefined });
    scene.render(shown, { ...options, aim: { x: 90, y: 220 } });
    expect(shown.data).not.toEqual(hidden.data);
    expect(shown.rgbAt(90, 220)).toEqual(PALETTE_RGB[COLOR.white]);
  });

  it('draws the flip flop in flight with the equipped skin colors', () => {
    const scene = new Scene();
    const state = throwSlipper(baseState(), { x: 90, y: 200 }).state;
    const advanced: RoundState = {
      ...state,
      flights: state.flights.map((f) => ({ ...f, elapsedMs: f.durationMs / 2 })),
    };
    const pink = newFrame();
    const blue = newFrame();
    const options = { state: advanced, effects: new Effects(), aim: undefined };
    scene.render(pink, { ...options, slipperSlots: [COLOR.magenta, COLOR.white] });
    scene.render(blue, { ...options, slipperSlots: [COLOR.sea, COLOR.white] });
    expect(pink.data).not.toEqual(blue.data);
  });

  describe('juice', () => {
    const flying = (progress: number): RoundState => {
      const state = throwSlipper(baseState(), { x: 90, y: 200 }).state;
      return {
        ...state,
        flights: state.flights.map((f) => ({ ...f, elapsedMs: f.durationMs * progress })),
      };
    };
    const hitAt = (effects: Effects): void =>
      effects.handle({
        type: 'CrabHit',
        crabId: 1,
        crabType: 'common',
        position: { x: 90, y: 200 },
        basePoints: 10,
        multiplier: 1,
        points: 10,
        combo: 1,
        score: 10,
      });

    it('leaves a trail behind a flip flop that has been flying for a while, in the skin color', () => {
      const scene = new Scene();
      const gold = newFrame();
      const pink = newFrame();
      const base = { state: flying(0.6), effects: new Effects(), aim: undefined };
      scene.render(gold, { ...base, trail: [COLOR.sun] });
      scene.render(pink, { ...base, trail: [COLOR.magenta] });
      expect(gold.data).not.toEqual(pink.data);
    });

    it('draws no trail for a flip flop that has just left the hand', () => {
      const scene = new Scene();
      const a = newFrame();
      const b = newFrame();
      const base = { state: flying(0), effects: new Effects(), aim: undefined };
      scene.render(a, { ...base, trail: [COLOR.sun] });
      scene.render(b, { ...base, trail: [COLOR.magenta] });
      expect(a.data).toEqual(b.data);
    });

    it('draws the particles of a hit', () => {
      const scene = new Scene();
      const quiet = newFrame();
      const burst = newFrame();
      const effects = new Effects();
      hitAt(effects);
      scene.render(quiet, { state: baseState(), effects: new Effects(), aim: undefined });
      scene.render(burst, { state: baseState(), effects, aim: undefined });
      expect(burst.data).not.toEqual(quiet.data);
    });

    it('shakes the picture while the effects ask for it, and stays still otherwise', () => {
      const scene = new Scene();
      const state = withCrabs(baseState(), makeCrab({ x: 90, y: 200 }));
      const effects = new Effects({ rng: createRng(3) });
      effects.handle({ type: 'ScoreMilestone', milestone: 100, score: 100 });
      const shaken = newFrame();
      for (let i = 0; i < 10 && effects.shake.x === 0 && effects.shake.y === 0; i += 1) {
        effects.update(16);
      }
      scene.render(shaken, { state, effects, aim: undefined });
      const plain = newFrame();
      const noShake = new Effects();
      noShake.handle({ type: 'ScoreMilestone', milestone: 100, score: 100 });
      scene.render(plain, { state, effects: noShake, aim: undefined });
      expect(effects.shake.x !== 0 || effects.shake.y !== 0).toBe(true);
      expect(shaken.data).not.toEqual(plain.data);
    });
  });

  it('prepare() draws a biome ahead of time without changing what is shown later', () => {
    const prepared = new Scene();
    const lazy = new Scene();
    prepared.prepare('night');
    const a = newFrame();
    const b = newFrame();
    prepared.renderBackdrop(a, 'night');
    lazy.renderBackdrop(b, 'night');
    expect(a.data).toEqual(b.data);
  });

  it('renders every biome without throwing', () => {
    const scene = new Scene();
    for (const biome of ['beach', 'rocks', 'mangrove', 'night'] as const) {
      const state = createRound({ level: makeLevel({ biome }), crabSpecs: TEST_CRAB_SPECS }, 1);
      expect(() =>
        scene.render(newFrame(), { state, effects: new Effects(), aim: undefined }),
      ).not.toThrow();
    }
  });

  it('keeps floating text inside the frame even at the edges', () => {
    const scene = new Scene();
    const effects = new Effects();
    effects.handle({
      type: 'CrabHit',
      crabId: 1,
      crabType: 'common',
      position: { x: 0, y: 0 },
      basePoints: 10,
      multiplier: 4,
      points: 40,
      combo: 9,
      score: 40,
    });
    expect(() =>
      scene.render(newFrame(), { state: baseState(), effects, aim: undefined }),
    ).not.toThrow();
  });
});
