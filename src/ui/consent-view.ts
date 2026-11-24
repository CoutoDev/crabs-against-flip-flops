import type { ConsentStatus } from '../application/consent';
import { button, el } from './dom';
import type { Translator } from './i18n/translator';
import type { MessageKey } from './i18n/messages/en';

/** What the banner needs to know about the current choice. */
export interface ConsentState {
  readonly status: ConsentStatus;
  /** The browser's privacy signal is what keeps analytics off. */
  readonly blockedBySignal: boolean;
}

export interface ConsentActions {
  accept(): void;
  reject(): void;
  /** Closed without changing anything (only offered when the banner was reopened on purpose). */
  cancel(): void;
}

const DETAILS: readonly MessageKey[] = [
  'consent.detail.what',
  'consent.detail.who',
  'consent.detail.cookies',
  'consent.detail.change',
];

/**
 * The analytics consent dialog. Accept and Reject sit side by side with the same size and weight
 * (refusing must be as easy as accepting). The first time it is a plain choice between the two;
 * when the player reopens it from the menu there is a Cancel as well, and Esc closes it.
 */
export class ConsentBanner {
  readonly root = el('div', 'overlay overlay--consent');
  private readonly heading = el('h2', 'overlay__title');
  private readonly text = el('p', 'overlay__text');
  private readonly status = el('p', 'consent__status');
  private readonly signal = el('p', 'consent__status');
  private readonly summary = el('summary', 'consent__summary');
  private readonly items = DETAILS.map((key) => ({ key, node: el('li') }));
  private readonly accept: HTMLButtonElement;
  private readonly reject: HTMLButtonElement;
  private readonly cancel: HTMLButtonElement;
  private dismissible = false;

  constructor(actions: ConsentActions) {
    this.root.dataset['overlay'] = 'consent';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.tabIndex = -1;
    this.heading.id = 'consent-title';
    this.root.setAttribute('aria-labelledby', this.heading.id);
    this.root.hidden = true;

    this.accept = button('control control--choice control--accept', actions.accept);
    this.reject = button('control control--choice', actions.reject);
    this.cancel = button('control control--choice', actions.cancel);
    const details = el(
      'details',
      'consent__details',
      this.summary,
      el('ul', 'consent__list', ...this.items.map((item) => item.node)),
    );
    this.root.append(
      this.heading,
      this.text,
      this.signal,
      this.status,
      el('div', 'consent__actions', this.accept, this.reject),
      this.cancel,
      details, // after the buttons: opening it never pushes them off the screen
    );
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.dismissible) {
        event.preventDefault();
        actions.cancel();
      }
    });
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  update(translator: Translator, state: ConsentState): void {
    const { t } = translator;
    this.heading.textContent = t('consent.title');
    this.text.textContent = t('consent.text');
    this.summary.textContent = t('consent.details');
    for (const { key, node } of this.items) node.textContent = t(key);
    this.accept.textContent = t('consent.accept');
    this.reject.textContent = t('consent.reject');
    this.cancel.textContent = t('consent.cancel');
    this.signal.textContent = state.blockedBySignal ? t('consent.signal') : '';
    this.signal.hidden = !state.blockedBySignal;
    // Only a choice that was really made is worth telling about.
    this.status.hidden = state.status === 'unset' || state.blockedBySignal;
    this.status.textContent =
      state.status === 'unset' ? '' : t(`consent.status.${state.status}` as MessageKey);
  }

  show(dismissible: boolean): void {
    this.dismissible = dismissible;
    this.cancel.hidden = !dismissible;
    this.root.hidden = false;
    this.root.focus({ preventScroll: true });
  }

  hide(): void {
    this.root.hidden = true;
  }
}
