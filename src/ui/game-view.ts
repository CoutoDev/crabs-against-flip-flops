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

/** Language and sound controls. They live inside the dialogs (menu, pause) to leave the field room. */
class SettingsPanel {
  readonly root = el('div', 'settings');
  private readonly label = el('span', 'settings__label');
  private readonly languages = new Map<Locale, HTMLButtonElement>();
  private readonly sound: HTMLButtonElement;

  constructor(id: string, actions: Pick<ViewActions, 'setLocale' | 'toggleSound'>) {
    const group = el('div', 'settings__group', this.label);
    group.setAttribute('role', 'group');
    this.label.id = `${id}-language-label`;
    group.setAttribute('aria-labelledby', this.label.id);
    for (const locale of LOCALES) {
      const b = button('control', () => actions.setLocale(locale));
      b.lang = locale;
      this.languages.set(locale, b);
      group.append(b);
    }
    this.sound = button('control', () => actions.toggleSound());
    this.root.append(group, this.sound);
  }

  update(translator: Translator, muted: boolean): void {
    const { t } = translator;
    this.label.textContent = t('settings.language');
    for (const [locale, b] of this.languages) {
      b.textContent = t(`language.${locale}`);
      b.setAttribute('aria-pressed', String(locale === translator.locale));
    }
    this.sound.textContent = t(muted ? 'sound.off' : 'sound.on');
    this.sound.setAttribute('aria-pressed', String(!muted));
  }
}

/** A modal panel over the canvas: title, optional text, one or two buttons and optional settings. */
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

  addSettings(panel: SettingsPanel): void {
    this.root.append(panel.root);
  }

  setTexts(title: string, text: string, primary: string, secondary?: string): void {
    this.heading.textContent = title;
    this.body.textContent = text;
    this.body.hidden = text === '';
    if (this.primary !== undefined) this.primary.textContent = primary;
    if (this.secondary !== undefined && secondary !== undefined) {
      this.secondary.textContent = secondary;
    }
  }

  focusPrimary(): void {
    this.primary?.focus({ preventScroll: true });
  }
}

/**
 * Everything the player sees around the canvas: a compact HUD (the only fixed chrome, so the
 * portrait field gets the height), the dialogs (menu, pause, end), help text and the live region
 * for screen readers. It builds the DOM once and then only updates text and visibility.
 */
export class GameView {
  readonly canvas = el('canvas', 'stage__canvas');

  private translator: Translator | undefined;
  private screen: Screen = 'menu';
  private hasShownScreen = false;
  private outcome: RoundOutcome | undefined;
  private lastHud: HudModel | undefined;
  private announceToggle = false;

  private readonly game = el('div', 'game');
  private readonly title = el('h1', 'sr-only');
  private readonly pauseButton: HTMLButtonElement;
  private readonly hud = el('div', 'hud');
  private readonly hudLevel = hudItem('level');
  private readonly hudScore = hudItem('score');
  private readonly hudAmmo = hudItem('ammo');
  private readonly hudCombo = hudItem('combo');
  private readonly progress = el('progress', 'hud__progress');
  private readonly stage = el('div', 'stage');
  private readonly help = el('p', 'help');
  private readonly live = el('p', 'sr-only');

  private readonly menu: Overlay;
  private readonly paused: Overlay;
  private readonly ended: Overlay;
  private readonly settings: readonly SettingsPanel[];

  constructor(root: HTMLElement, actions: ViewActions) {
    this.pauseButton = button('control control--square', actions.pause);
    this.pauseButton.textContent = 'II';

    this.progress.max = 1;
    this.hud.append(
      this.hudLevel.root,
      this.hudScore.root,
      this.hudAmmo.root,
      this.hudCombo.root,
      this.pauseButton,
      this.progress,
    );

    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');

    const menuSettings = new SettingsPanel('menu', actions);
    const pausedSettings = new SettingsPanel('paused', actions);
    this.settings = [menuSettings, pausedSettings];

    this.menu = new Overlay('menu', 'game-menu');
    this.menu.addPrimary(actions.play);
    this.menu.addSettings(menuSettings);
    this.paused = new Overlay('paused', 'game-paused');
    this.paused.addPrimary(actions.resume);
    this.paused.addSecondary(actions.toMenu);
    this.paused.addSettings(pausedSettings);
    this.ended = new Overlay('ended', 'game-ended');
    this.ended.addPrimary(actions.play);
    this.ended.addSecondary(actions.toMenu);

    this.stage.append(this.canvas, this.menu.root, this.paused.root, this.ended.root);
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    this.game.append(this.title, this.hud, this.stage, this.help, this.live);
    root.replaceChildren(this.game);
  }

  /**
   * Calls `listener` whenever the HUD changes size (texts arriving, a label wrapping, a font
   * loading), since that changes the room left for the canvas. It never fires because of the
   * canvas itself, so refitting from it cannot loop.
   */
  onLayoutChange(listener: () => void): void {
    new ResizeObserver(listener).observe(this.hud);
  }

  /** (Re)writes every static text. Call it whenever the language or the mute state changes. */
  setTranslator(translator: Translator, muted: boolean): void {
    this.translator = translator;
    this.lastHud = undefined;
    const { t } = translator;

    document.documentElement.lang = translator.locale;
    document.title = t('game.title');
    this.title.textContent = t('game.title');
    for (const panel of this.settings) panel.update(translator, muted);
    this.pauseButton.setAttribute('aria-label', t('pause.button'));
    this.hud.setAttribute('aria-label', t('game.title'));
    this.hudScore.label.textContent = t('hud.score');
    this.hudAmmo.label.textContent = t('hud.ammo');
    this.hudCombo.label.textContent = t('hud.combo');
    this.canvas.setAttribute('aria-label', t('canvas.label'));
    this.help.textContent = t('controls.help');

    this.menu.setTexts(t('game.title'), t('game.tagline'), t('menu.play'));
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
    if (last?.score !== model.score || last.goal !== model.goal) {
      this.hudScore.value.textContent = `${model.score} / ${model.goal}`;
    }
    if (last?.ammo !== model.ammo) this.hudAmmo.value.textContent = model.ammo;
    if (last?.combo !== model.combo) this.hudCombo.value.textContent = model.combo;
    if (last?.progress !== model.progress) this.progress.value = model.progress;
    if (last?.ammoLow !== model.ammoLow) {
      this.hudAmmo.root.classList.toggle('hud__item--low', model.ammoLow);
    }
    if (last?.goal !== model.goal) {
      const goal = this.translator?.t('hud.goal') ?? '';
      this.progress.setAttribute('aria-label', `${goal}: ${model.goal}`);
    }
    this.lastHud = model;
  }

  /** Re-announces identical messages too by alternating an invisible suffix. */
  announce(message: string): void {
    this.announceToggle = !this.announceToggle;
    this.live.textContent = message + (this.announceToggle ? '​' : '');
  }

  /**
   * Room left for the canvas, in CSS pixels, so the presenter can pick the largest crisp scale.
   * Normally the HUD sits above the field; in a short landscape window (a phone on its side) it
   * moves beside it, and the layout is detected by looking at where the boxes actually are.
   */
  availableSize(): { readonly width: number; readonly height: number } {
    const body = getComputedStyle(document.body);
    const paddingX = parseFloat(body.paddingLeft) + parseFloat(body.paddingRight);
    const paddingY = parseFloat(body.paddingTop) + parseFloat(body.paddingBottom);
    const viewportWidth = document.documentElement.clientWidth - paddingX;
    const viewportHeight = window.innerHeight - paddingY;

    // The stage frame (border) is chrome too: only the canvas itself scales.
    const frameX = this.stage.offsetWidth - this.canvas.offsetWidth;
    const frameY = this.stage.offsetHeight - this.canvas.offsetHeight;

    const hud = this.hud.getBoundingClientRect();
    const stage = this.stage.getBoundingClientRect();
    const besideField = hud.right <= stage.left + 1;
    if (besideField) {
      const gap = parseFloat(getComputedStyle(this.game).columnGap) || 0;
      return {
        width: viewportWidth - this.hud.offsetWidth - gap - frameX,
        height: viewportHeight - frameY,
      };
    }
    const overhead = this.game.offsetHeight - this.canvas.offsetHeight;
    return { width: viewportWidth - frameX, height: viewportHeight - overhead };
  }

  private renderEnded(): void {
    const translator = this.translator;
    const outcome = this.outcome;
    if (translator === undefined || outcome === undefined) return;
    const { t } = translator;
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
    // `visibility`, not `hidden`: the HUD keeps its space, so the canvas scale never jumps between
    // screens; it also removes the HUD from the accessibility tree while it is invisible.
    this.hud.style.visibility = this.screen === 'menu' ? 'hidden' : '';
    this.pauseButton.style.visibility = inRound ? '' : 'hidden';
    this.pauseButton.disabled = this.screen !== 'playing';
    this.stage.dataset['screen'] = this.screen;
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
