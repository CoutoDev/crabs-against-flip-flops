/**
 * The economy as data (D38, agreed on 2026-11-23). Points measure performance and are never spent
 * directly: they sit in the point bank until the player converts them into coins, which is what
 * the shop charges. Both numbers can be tuned without touching any rule.
 */

/** X points make 1 coin. Conversion is one way: coins never turn back into points. */
export const POINTS_PER_COIN = 5;

/**
 * Share of a round's points that reach the point bank when the level was already cleared before
 * (anti-farm): replaying the easiest level cannot buy the whole shop. Records, the scoreboard and
 * achievements keep the full points.
 */
export const REPLAY_BANK_PERCENT = 50;
