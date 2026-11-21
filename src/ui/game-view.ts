import type { RoundOutcome, Screen } from '../application/game-flow';
import { LOCALES, type Locale } from '../application/locale';
import type { HudModel } from './hud-model';
import type { Translator } from './i18n/translator';

export interface ViewActions {
  play(): void;
  resume(): void;
  pause(): void;
  toMenu(): void;
  setLocale(locale: Locale): void;
  toggleSound(): void;
}

type OverlayScreen = Exclude<Screen, 'playing'>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className !== undefined) element.className = className;
  element.append(...children);
  return element;
}

function button(className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

interface HudItem {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly value: HTMLElement;
}

function hudItem(modifier: string): HudItem {
  const label = el('span', 'hud__label');
  const value = el('span', 'hud__value');
  return { root: el('div', `hud__item hud__item--${modifier}`, label, value), label, value };
}

/**
 * Everything the player sees around the canvas: top bar, HUD, overlays (menu, pause, end),
 * help text and the live region for screen readers. It builds the DOM once and then only updates
 * text and visibility. The texts it shows are decided elsewhere (hud-model, i18n).
 */
export class GameView {
  readonly canvas = el('canvas', 'stage__canvas');

  private translator: Translator | undefined;
  private screen: Screen = 'menu';
  private hasShownScreen = false;
  private outcome: RoundOutcome | undefined;
  private muted = false;
  private lastHud: HudModel | undefined;
  private announceToggle = false;

  private readonly game = el('div', 'game');
  private readonly title = el('h1', 'topbar__title');
  private readonly languageLabel = el('span', 'locale-switcher__label');
  private readonly languageButtons = new Map<Locale, HTMLButtonElement>();
  private readonly soundButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly hud = el('div', 'hud');
  private readonly hudLevel = hudItem('level');
  private readonly hudScore = hudItem('score');
  private readonly hudGoal = hudItem('goal');
  private readonly hudAmmo = hudItem('ammo');
  private readonly hudCombo = hudItem('combo');
  private readonly progress = el('progress', 'hud__progress');
  private readonly stage = el('div', 'stage');
  private readonly help = el('p', 'help');
  private readonly live = el('p', 'sr-only');

  private readonly menu: Overlay;
  private readonly paused: Overlay;
  private readonly ended: Overlay;

  constructor(root: HTMLElement, actions: ViewActions) {
    this.soundButton = button('control', actions.toggleSound);
    this.pauseButton = button('control', actions.pause);

    const switcher = el('div', 'locale-switcher', this.languageLabel);
    switcher.setAttribute('role', 'group');
    this.languageLabel.id = 'locale-label';
    switcher.setAttribute('aria-labelledby', this.languageLabel.id);
    for (const locale of LOCALES) {
      const b = button('control', () => actions.setLocale(locale));
      b.lang = locale;
      this.languageButtons.set(locale, b);
      switcher.append(b);
    }
    const topbar = el(
      'header',
      'topbar',
      this.title,
      el('div', 'topbar__controls', switcher, this.soundButton),
    );

    this.progress.max = 1;
    this.hud.append(
      this.hudLevel.root,
      this.hudScore.root,
      this.hudGoal.root,
      this.hudAmmo.root,
      this.hudCombo.root,
      this.pauseButton,
      el('div', 'hud__break'), // forces the progress bar onto its own line, always
      this.progress,
    );

    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');

    this.menu = new Overlay('menu', 'game-menu');
    this.menu.addPrimary(actions.play);
    this.paused = new Overlay('paused', 'game-paused');
    this.paused.addPrimary(actions.resume);
    this.paused.addSecondary(actions.toMenu);
    this.ended = new Overlay('ended', 'game-ended');
    this.ended.addPrimary(actions.play);
    this.ended.addSecondary(actions.toMenu);

    this.stage.append(this.canvas, this.menu.root, this.paused.root, this.ended.root);
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    this.game.append(topbar, this.hud, this.stage, this.help, this.live);
    root.replaceChildren(this.game);
  }

  /** (Re)writes every static text. Call it whenever the language or the mute state changes. */
  setTranslator(translator: Translator, muted: boolean): void {
    this.translator = translator;
    this.muted = muted;
    this.lastHud = undefined;
    const { t } = translator;

    document.documentElement.lang = translator.locale;
    document.title = t('game.title');
    this.title.textContent = t('game.title');
    this.languageLabel.textContent = t('settings.language');
    for (const [locale, b] of this.languageButtons) {
      b.textContent = t(`language.${locale}`);
      b.setAttribute('aria-pressed', String(locale === translator.locale));
    }
    this.soundButton.textContent = t(muted ? 'sound.off' : 'sound.on');
    this.soundButton.setAttribute('aria-pressed', String(!muted));
    this.pauseButton.textContent = t('pause.button');
    this.hud.setAttribute('aria-label', t('game.title'));
    this.hudScore.label.textContent = t('hud.score');
    this.hudGoal.label.textContent = t('hud.goal');
    this.hudAmmo.label.textContent = t('hud.ammo');
    this.hudCombo.label.textContent = t('hud.combo');
    this.canvas.setAttribute('aria-label', t('canvas.label'));
    this.help.textContent = t('controls.help');

    this.menu.setTexts(t('game.tagline'), '', t('menu.play'));
    this.paused.setTexts(t('pause.title'), '', t('pause.resume'), t('round.menu'));
    this.renderEnded();
    this.renderScreen();
  }

  showScreen(screen: Screen, outcome: RoundOutcome | undefined): void {
    const previous = this.screen;
    this.screen = screen;
    this.outcome = outcome;
    this.renderEnded();
    this.renderScreen();
    if (previous !== screen || !this.hasShownScreen) this.moveFocus();
    this.hasShownScreen = true;
  }

  /** Copies the HUD strings to the DOM, touching only what changed. */
  updateHud(model: HudModel): void {
    const last = this.lastHud;
    if (last?.level !== model.level) this.hudLevel.value.textContent = model.level;
    if (last?.score !== model.score) this.hudScore.value.textContent = model.score;
    if (last?.goal !== model.goal) this.hudGoal.value.textContent = model.goal;
    if (last?.ammo !== model.ammo) this.hudAmmo.value.textContent = model.ammo;
    if (last?.combo !== model.combo) this.hudCombo.value.textContent = model.combo;
    if (last?.progress !== model.progress) this.progress.value = model.progress;
    if (last?.ammoLow !== model.ammoLow) {
      this.hudAmmo.root.classList.toggle('hud__item--low', model.ammoLow);
    }
    this.progress.setAttribute(
      'aria-label',
      `${this.hudGoal.label.textContent ?? ''}: ${model.goal}`,
    );
    this.lastHud = model;
  }

  /** Re-announces identical messages too (e.g. two misses in a row) by alternating an invisible suffix. */
  announce(message: string): void {
    this.announceToggle = !this.announceToggle;
    this.live.textContent = message + (this.announceToggle ? '​' : '');
  }

  /** Room left for the canvas, so the presenter can pick the largest integer scale. */
  availableSize(): { readonly width: number; readonly height: number } {
    const style = getComputedStyle(document.body);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const overhead = this.game.offsetHeight - this.stage.offsetHeight;
    return {
      width: document.documentElement.clientWidth - paddingX,
      height: window.innerHeight - paddingY - overhead,
    };
  }

  private renderEnded(): void {
    const translator = this.translator;
    if (translator === undefined) return;
    const { t } = translator;
    const outcome = this.outcome;
    if (outcome === undefined) return;
    const won = outcome.result === 'won';
    this.ended.setTexts(
      t(won ? 'round.won.title' : 'round.lost.title'),
      t('round.summary', { score: outcome.score, hits: outcome.hits, throws: outcome.throws }),
      t(won ? 'round.again' : 'round.retry'),
      t('round.menu'),
    );
    this.ended.root.dataset['result'] = outcome.result;
  }

  private renderScreen(): void {
    const overlays: Readonly<Record<OverlayScreen, Overlay>> = {
      menu: this.menu,
      paused: this.paused,
      ended: this.ended,
    };
    for (const [name, overlay] of Object.entries(overlays) as [OverlayScreen, Overlay][]) {
      overlay.root.hidden = this.screen !== name;
    }
    const inRound = this.screen === 'playing' || this.screen === 'paused';
    // `visibility`, like the HUD: the button keeps its space so the layout never shifts.
    this.pauseButton.style.visibility = inRound ? '' : 'hidden';
    this.pauseButton.disabled = this.screen !== 'playing';
    // `visibility` (not `hidden`) keeps the HUD's height, so the canvas keeps the same integer
    // scale on the menu and in the round; it also removes the HUD from the accessibility tree.
    this.hud.style.visibility = this.screen === 'menu' ? 'hidden' : '';
    this.stage.dataset['screen'] = this.screen;
    this.soundButton.setAttribute('aria-pressed', String(!this.muted));
  }

  private moveFocus(): void {
    switch (this.screen) {
      case 'playing':
        this.canvas.focus({ preventScroll: true });
        break;
      case 'menu':
        this.menu.focusPrimary();
        break;
      case 'paused':
        this.paused.focusPrimary();
        break;
      case 'ended':
        this.ended.focusPrimary();
        break;
    }
  }
}

/** A modal panel over the canvas with a title, optional text and one or two buttons. */
class Overlay {
  readonly root = el('div', 'overlay');
  private readonly heading = el('h2', 'overlay__title');
  private readonly body = el('p', 'overlay__text');
  private primary: HTMLButtonElement | undefined;
  private secondary: HTMLButtonElement | undefined;

  constructor(name: string, id: string) {
    this.root.dataset['overlay'] = name;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.heading.id = `${id}-title`;
    this.root.setAttribute('aria-labelledby', this.heading.id);
    this.root.hidden = true;
    this.root.append(this.heading, this.body);
  }

  addPrimary(onClick: () => void): void {
    this.primary = button('control control--primary', onClick);
    this.root.append(this.primary);
  }

  addSecondary(onClick: () => void): void {
    this.secondary = button('control', onClick);
    this.root.append(this.secondary);
  }

  setTexts(title: string, text: string, primary: string, secondary?: string): void {
    this.heading.textContent = title;
    this.body.textContent = text;
    this.body.hidden = text === '';
    if (this.primary !== undefined) this.primary.textContent = primary;
    if (this.secondary !== undefined && secondary !== undefined)
      this.secondary.textContent = secondary;
  }

  focusPrimary(): void {
    this.primary?.focus({ preventScroll: true });
  }
}
