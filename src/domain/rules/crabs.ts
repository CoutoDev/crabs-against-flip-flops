import { CRAB_SPAWN_MARGIN_PX, FIELD_WIDTH_PX } from '../constants';
import type { Crab } from '../entities/crab';
import type { LevelConfig } from '../entities/level';
import { between, pickWeighted, type Rng } from '../rng';

/**
 * Spawns a crab just outside one side of the field. Draw order is part of the contract
 * (it keeps replays stable): type, speed, direction, lane.
 */
export function spawnCrab(id: number, level: LevelConfig, rng: Rng): Crab {
  const entry = pickWeighted(rng, level.crabs, (e) => e.weight);
  const speedPxPerSec = between(rng, entry.speedPxPerSec.min, entry.speedPxPerSec.max);
  const direction = rng.next() < 0.5 ? 1 : -1;
  const y = between(rng, level.spawn.laneY.min, level.spawn.laneY.max);
  const x = direction === 1 ? -CRAB_SPAWN_MARGIN_PX : FIELD_WIDTH_PX + CRAB_SPAWN_MARGIN_PX;
  return { id, type: entry.type, x, y, direction, speedPxPerSec };
}

export function moveCrab(crab: Crab, dtMs: number): Crab {
  return { ...crab, x: crab.x + crab.direction * crab.speedPxPerSec * (dtMs / 1000) };
}

/** True once a crab has fully walked off the side it was heading to. */
export function isCrabGone(crab: Crab): boolean {
  return crab.direction === 1
    ? crab.x > FIELD_WIDTH_PX + CRAB_SPAWN_MARGIN_PX
    : crab.x < -CRAB_SPAWN_MARGIN_PX;
}
