import type { EventBus } from '../../application/event-bus';
import type { DomainEvent } from '../../domain/events';
import { sfxForEvent, type SfxRequest } from './sfx-for-event';

export interface SfxPlayer {
  play(request: SfxRequest): void;
}

/** Makes the game audible: every domain event that has a sound plays it. Returns an unsubscribe. */
export function bindSfx(bus: EventBus<DomainEvent>, player: SfxPlayer): () => void {
  return bus.subscribe((event) => {
    const request = sfxForEvent(event);
    if (request !== undefined) player.play(request);
  });
}
