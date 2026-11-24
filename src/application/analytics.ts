/**
 * What the game tells its analytics tool. Every event has a fixed shape: the tool keeps the
 * values of earlier events, so a value that is sometimes missing would leak into the next event.
 * Only ids, numbers and booleans go out, never text the player typed (their name is never sent).
 */
export type AnalyticsEvent =
  | {
      readonly name: 'level_start';
      readonly params: { readonly level_id: number; readonly biome: string };
    }
  | {
      readonly name: 'level_end';
      readonly params: {
        readonly level_id: number;
        readonly biome: string;
        readonly success: boolean;
        readonly score: number;
        readonly hits: number;
        readonly throws: number;
        /** hits / throws as a percentage, 0 when nothing was thrown. */
        readonly accuracy_pct: number;
        readonly new_best: boolean;
      };
    }
  | { readonly name: 'campaign_complete'; readonly params: { readonly score: number } }
  | {
      /** The player left a round that was still running (from the pause to the menu). */
      readonly name: 'level_quit';
      readonly params: { readonly level_id: number; readonly biome: string };
    }
  | {
      readonly name: 'game_pause';
      readonly params: { readonly level_id: number };
    }
  | {
      /** The GA4 recommended event for spending a virtual currency (the points). */
      readonly name: 'spend_virtual_currency';
      readonly params: {
        readonly value: number;
        readonly virtual_currency_name: 'points';
        readonly item_name: string;
      };
    }
  | { readonly name: 'skin_equip'; readonly params: { readonly skin_id: string } }
  | { readonly name: 'language_change'; readonly params: { readonly language: string } }
  | {
      readonly name: 'audio_change';
      readonly params: {
        readonly setting: 'sound' | 'music' | 'volume';
        /** 0 or 1 for the switches, 0..100 for the volume. */
        readonly value: number;
      };
    };

/** Where events go. The implementation decides whether anything is actually sent (consent). */
export interface AnalyticsPort {
  track(event: AnalyticsEvent): void;
}
