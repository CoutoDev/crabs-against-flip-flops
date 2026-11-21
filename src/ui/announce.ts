import type { DomainEvent } from '../domain/events';
import type { Translator } from './i18n/translator';

/**
 * Text for the screen-reader live region. By decision (ADR section 6) only score milestones are
 * announced: announcing every hit or miss would talk over the player. The end of the round needs
 * no announcement because its dialog takes focus and is read by itself.
 */
export function announcementFor(event: DomainEvent, translator: Translator): string | undefined {
  if (event.type === 'ScoreMilestone') {
    return translator.t('announce.milestone', { milestone: event.milestone });
  }
  return undefined;
}
