import { FIELD_HEIGHT_PX } from '../constants';
import type { CrabSpecs } from '../entities/crab';
import type { LevelConfig } from '../entities/level';
import { comboMultiplier } from './scoring';

const isIntAtLeast = (value: number, min: number): boolean =>
  Number.isInteger(value) && value >= min;

/** Best possible score: every throw hits the most valuable crab, no miss in between. */
export function maxPossibleScore(level: LevelConfig, specs: CrabSpecs): number {
  const bestBase = Math.max(...level.crabs.map((entry) => specs[entry.type].points));
  let total = 0;
  for (let hit = 1; hit <= level.ammo; hit += 1) {
    total += bestBase * comboMultiplier(hit, level.scoring);
  }
  return total;
}

/** Human-readable problems with a level config; an empty list means the level is playable. */
export function validateLevel(level: LevelConfig, specs: CrabSpecs): string[] {
  const problems: string[] = [];
  const { spawn, throw: thrown, scoring } = level;

  if (!isIntAtLeast(level.ammo, 1)) problems.push('ammo must be an integer >= 1');
  if (!isIntAtLeast(level.targetScore, 1)) problems.push('targetScore must be an integer >= 1');

  if (!(spawn.intervalMs.min > 0 && spawn.intervalMs.min <= spawn.intervalMs.max)) {
    problems.push('spawn.intervalMs must satisfy 0 < min <= max');
  }
  if (!isIntAtLeast(spawn.maxOnScreen, 1))
    problems.push('spawn.maxOnScreen must be an integer >= 1');
  if (!(
    spawn.laneY.min >= 0 &&
    spawn.laneY.min <= spawn.laneY.max &&
    spawn.laneY.max <= FIELD_HEIGHT_PX
  )) {
    problems.push(`spawn.laneY must satisfy 0 <= min <= max <= ${FIELD_HEIGHT_PX}`);
  }

  if (level.crabs.length === 0) problems.push('crabs must not be empty');
  level.crabs.forEach((entry, index) => {
    if (specs[entry.type] === undefined) {
      problems.push(`crabs[${index}].type "${entry.type}" has no spec`);
    }
    if (!(entry.weight > 0 && Number.isFinite(entry.weight))) {
      problems.push(`crabs[${index}].weight must be > 0`);
    }
    if (!(entry.speedPxPerSec.min > 0 && entry.speedPxPerSec.min <= entry.speedPxPerSec.max)) {
      problems.push(`crabs[${index}].speedPxPerSec must satisfy 0 < min <= max`);
    }
  });

  if (!(thrown.speedPxPerSec > 0)) problems.push('throw.speedPxPerSec must be > 0');
  if (!(thrown.minFlightMs > 0 && thrown.minFlightMs <= thrown.maxFlightMs)) {
    problems.push('throw.minFlightMs/maxFlightMs must satisfy 0 < min <= max');
  }
  if (!(thrown.arcHeightPx >= 0)) problems.push('throw.arcHeightPx must be >= 0');

  if (!isIntAtLeast(scoring.comboStep, 1))
    problems.push('scoring.comboStep must be an integer >= 1');
  if (!isIntAtLeast(scoring.maxMultiplier, 1)) {
    problems.push('scoring.maxMultiplier must be an integer >= 1');
  }
  if (!isIntAtLeast(scoring.milestoneEvery, 1)) {
    problems.push('scoring.milestoneEvery must be an integer >= 1');
  }

  // Reachability only makes sense once everything it depends on is valid.
  if (problems.length === 0) {
    const best = maxPossibleScore(level, specs);
    if (level.targetScore > best) {
      problems.push(
        `targetScore (${level.targetScore}) is unreachable: the best case with ${level.ammo} throws is ${best}`,
      );
    }
  }
  return problems;
}

export function assertValidLevel(level: LevelConfig, specs: CrabSpecs): void {
  const problems = validateLevel(level, specs);
  if (problems.length > 0) {
    throw new Error(`Invalid level ${level.id}:\n- ${problems.join('\n- ')}`);
  }
}
