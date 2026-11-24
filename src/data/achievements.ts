import type { AchievementCatalog } from '../application/achievements';

/**
 * The achievements (D36, list approved on 2026-11-24). Each one is data: a condition over the
 * lifetime counters and the levels won, and the coins it pays. The items it unlocks are the ones
 * in `skins.ts` whose `acquire` names its id (an item is bought or earned, never both).
 * Names and hints are `achievements.<id>.name` and `achievements.<id>.hint` in the catalogs.
 *
 * Coins here are small on purpose: the whole list pays 217 coins, against 1,350 for the shop.
 */
export const ACHIEVEMENTS: AchievementCatalog = [
  { id: 'first-hit', condition: { kind: 'hits', atLeast: 1 }, coins: 5 },
  { id: 'combo-4', condition: { kind: 'combo', atLeast: 4 }, coins: 10 },
  { id: 'combo-8', condition: { kind: 'combo', atLeast: 8 }, coins: 20 },
  { id: 'flawless-win', condition: { kind: 'flawlessWin' } },
  { id: 'spare-flip-flops', condition: { kind: 'winWithAmmo', atLeast: 5 }, coins: 15 },
  { id: 'fiddlers', condition: { kind: 'crabHits', crab: 'fiddler', atLeast: 25 }, coins: 15 },
  { id: 'clear-beach', condition: { kind: 'biomeCleared', biome: 'beach' }, coins: 12 },
  { id: 'clear-rocks', condition: { kind: 'biomeCleared', biome: 'rocks' }, coins: 20 },
  { id: 'clear-mangrove', condition: { kind: 'biomeCleared', biome: 'mangrove' }, coins: 30 },
  { id: 'clear-night', condition: { kind: 'biomeCleared', biome: 'night' }, coins: 40 },
  { id: 'campaign-cleared', condition: { kind: 'campaignCleared' } },
  { id: 'points-10000', condition: { kind: 'totalPoints', atLeast: 10_000 }, coins: 50 },
  { id: 'veteran', condition: { kind: 'wins', atLeast: 50 } },
];
