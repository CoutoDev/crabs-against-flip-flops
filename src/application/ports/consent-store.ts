/**
 * What the player decided about analytics, and when. Stored apart from the game save: the save is
 * the player's progress, this is a legal record, and clearing one must not touch the other.
 */
export interface ConsentRecord {
  /** Bumped when what we ask consent for changes, so everyone is asked again. */
  readonly version: number;
  readonly analytics: boolean;
  /** Epoch milliseconds of the decision. */
  readonly decidedAt: number;
}

export interface ConsentStore {
  /** The stored value (untrusted), or `undefined` when there is none or it cannot be read. Never throws. */
  load(): unknown;
  /** Best effort, never throws. */
  save(record: ConsentRecord): void;
}
