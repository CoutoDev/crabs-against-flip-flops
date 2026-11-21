import { describe, expect, it } from 'vitest';
import { CRAB_SPAWN_MARGIN_PX, FIELD_WIDTH_PX } from '../constants';

const RIGHT_EDGE = FIELD_WIDTH_PX + CRAB_SPAWN_MARGIN_PX;
import { makeCrab, makeLevel, sequenceRng } from '../test-support';
import { isCrabGone, moveCrab, spawnCrab } from './crabs';

const level = makeLevel({
  crabs: [{ type: 'swimmer', weight: 1, speedPxPerSec: { min: 20, max: 60 } }],
  spawn: {
    intervalMs: { min: 500, max: 1000 },
    maxOnScreen: 3,
    laneY: { min: 80, max: 140 },
  },
});

describe('spawnCrab', () => {
  it('spawns left-to-right from just outside the left edge', () => {
    // draws: type, speed, direction (<0.5 → +1), lane
    const crab = spawnCrab(7, level, sequenceRng([0, 0.5, 0.2, 0.5]));
    expect(crab).toEqual({
      id: 7,
      type: 'swimmer',
      x: -16,
      y: 110,
      direction: 1,
      speedPxPerSec: 40,
    });
  });

  it('spawns right-to-left from just outside the right edge', () => {
    const crab = spawnCrab(8, level, sequenceRng([0, 0, 0.9, 0]));
    expect(crab).toMatchObject({ x: RIGHT_EDGE, y: 80, direction: -1, speedPxPerSec: 20 });
  });

  it('chooses the crab type by weight', () => {
    const mixed = makeLevel({
      crabs: [
        { type: 'common', weight: 1, speedPxPerSec: { min: 20, max: 40 } },
        { type: 'fiddler', weight: 1, speedPxPerSec: { min: 20, max: 40 } },
      ],
    });
    expect(spawnCrab(1, mixed, sequenceRng([0.1, 0, 0, 0])).type).toBe('common');
    expect(spawnCrab(1, mixed, sequenceRng([0.9, 0, 0, 0])).type).toBe('fiddler');
  });

  it('consumes exactly four draws', () => {
    const rng = sequenceRng([0.3]);
    spawnCrab(1, level, rng);
    expect(rng.state).toBe(4);
  });
});

describe('moveCrab', () => {
  it('walks left to right', () => {
    const crab = makeCrab({ direction: 1, speedPxPerSec: 100 });
    expect(moveCrab(crab, 500).x).toBe(150);
  });

  it('walks right to left', () => {
    const crab = makeCrab({ direction: -1, speedPxPerSec: 100 });
    expect(moveCrab(crab, 500).x).toBe(50);
  });

  it('keeps its lane and does not mutate the previous state', () => {
    const crab = makeCrab({ speedPxPerSec: 100 });
    const moved = moveCrab(crab, 500);
    expect(moved.y).toBe(crab.y);
    expect(crab.x).toBe(100);
  });
});

describe('isCrabGone', () => {
  it('is false while a crab is on screen or still inside the margin', () => {
    expect(isCrabGone(makeCrab({ x: FIELD_WIDTH_PX / 2 }))).toBe(false);
    expect(isCrabGone(makeCrab({ x: RIGHT_EDGE, direction: 1 }))).toBe(false);
    expect(isCrabGone(makeCrab({ x: -16, direction: -1 }))).toBe(false);
  });

  it('is true once it walked past the margin on its exit side', () => {
    expect(isCrabGone(makeCrab({ x: RIGHT_EDGE + 0.01, direction: 1 }))).toBe(true);
    expect(isCrabGone(makeCrab({ x: -16.01, direction: -1 }))).toBe(true);
  });

  it('does not remove a crab that has just spawned on the far side', () => {
    expect(isCrabGone(makeCrab({ x: -16, direction: 1 }))).toBe(false);
    expect(isCrabGone(makeCrab({ x: RIGHT_EDGE, direction: -1 }))).toBe(false);
  });
});
