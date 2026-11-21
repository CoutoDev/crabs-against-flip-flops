import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../domain/events';
import { makeLevel, must, TEST_CRAB_SPECS } from '../domain/test-support';
import { AIM_FAST_STEP_PX, AIM_STEP_PX, DEFAULT_AIM } from './aim';
import { EventBus } from './event-bus';
import { GameFlow } from './game-flow';
import { PlayerControls } from './player-controls';

function setup() {
  const bus = new EventBus<DomainEvent>();
  const flow = new GameFlow({
    levels: [makeLevel()],
    crabSpecs: TEST_CRAB_SPECS,
    newSeed: () => 1,
    bus,
  });
  return { flow, controls: new PlayerControls(flow), bus };
}

describe('PlayerControls', () => {
  it('starts aiming at the default point', () => {
    expect(setup().controls.aim).toEqual(DEFAULT_AIM);
  });

  it('does nothing on the menu (so keys stay free for the buttons)', () => {
    const { controls } = setup();
    expect(controls.handle({ kind: 'throw' })).toBe(false);
    expect(controls.handle({ kind: 'aim', dx: 1, dy: 0, fast: false })).toBe(false);
    expect(controls.handle({ kind: 'pause' })).toBe(false);
    expect(controls.pointerPressed({ x: 10, y: 10 })).toBe(false);
    expect(controls.aim).toEqual(DEFAULT_AIM);
    expect(controls.aimVisible).toBe(false);
  });

  it('moves the aim with the keyboard, faster with Shift', () => {
    const { flow, controls } = setup();
    flow.play();
    expect(controls.handle({ kind: 'aim', dx: 1, dy: 0, fast: false })).toBe(true);
    expect(controls.aim.x).toBe(DEFAULT_AIM.x + AIM_STEP_PX);
    controls.handle({ kind: 'aim', dx: 0, dy: -1, fast: true });
    expect(controls.aim.y).toBe(DEFAULT_AIM.y - AIM_FAST_STEP_PX);
    expect(controls.aimVisible).toBe(true);
  });

  it('throws at the aim point with the keyboard', () => {
    const { flow, controls } = setup();
    flow.play();
    expect(controls.handle({ kind: 'throw' })).toBe(true);
    const state = must(flow.session).state;
    expect(state.throws).toBe(1);
    expect(state.flights[0]?.target).toEqual(DEFAULT_AIM);
  });

  it('aims and throws where the pointer was pressed', () => {
    const { flow, controls } = setup();
    flow.play();
    expect(controls.pointerPressed({ x: 40, y: 90 })).toBe(true);
    expect(controls.aim).toEqual({ x: 40, y: 90 });
    expect(must(flow.session).state.flights[0]?.target).toEqual({ x: 40, y: 90 });
  });

  it('follows the pointer without throwing', () => {
    const { flow, controls } = setup();
    flow.play();
    controls.pointerMoved({ x: 200, y: 60 });
    expect(controls.aim).toEqual({ x: 200, y: 60 });
    expect(must(flow.session).state.throws).toBe(0);
  });

  it('pauses and resumes, and ignores moves and throws while paused', () => {
    const { flow, controls } = setup();
    flow.play();
    expect(controls.handle({ kind: 'pause' })).toBe(true);
    expect(flow.screen).toBe('paused');
    expect(controls.handle({ kind: 'throw' })).toBe(false);
    expect(controls.handle({ kind: 'aim', dx: 1, dy: 0, fast: false })).toBe(false);
    controls.pointerMoved({ x: 1, y: 1 });
    expect(controls.pointerPressed({ x: 1, y: 1 })).toBe(false);
    expect(controls.aim).toEqual(DEFAULT_AIM);
    expect(must(flow.session).state.throws).toBe(0);
    expect(controls.handle({ kind: 'pause' })).toBe(true);
    expect(flow.screen).toBe('playing');
  });

  it('does not pause from the end screen', () => {
    const { flow, controls, bus } = setup();
    flow.play();
    bus.publish({ type: 'RoundLost', score: 0 });
    expect(flow.screen).toBe('ended');
    expect(controls.handle({ kind: 'pause' })).toBe(false);
  });
});
