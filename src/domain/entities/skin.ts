/**
 * A cosmetic for the flip flop (D15): it never changes how the game plays. The domain only knows
 * what a skin costs; its colors live in the renderer, keyed by `id`.
 */
export interface Skin {
  readonly id: string;
  /** Price in points; 0 means it is owned from the start. */
  readonly price: number;
}

export type SkinCatalog = readonly Skin[];
