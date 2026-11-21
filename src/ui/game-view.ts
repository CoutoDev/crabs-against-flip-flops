import type { RoundOutcome, Screen } from '../application/game-flow';
import { LOCALES, type Locale } from '../application/locale';
import type { CrabType } from '../domain/entities/crab';
import type { Biome } from '../domain/entities/level';
import { canvasLabelKey, crabNameKey, levelName } from './campaign-text';
import { button, el } from './dom';
import type { HudModel } from './hud-model';
import type { Translator } from './i18n/translator';
import { NameField, ShopList, skinName, type ShopModel } from './shop-view';

/** What the settings panels show about the audio. */
export interface AudioSettings {
  readonly muted: boolean;
  readonly music: boolean;
  /** 0..1 */
  readonly volume: number;
}

export interface ViewActions {
  play(): void;
  start(): void;
  retry(): void;
  next(): void;
  selectLevel(index: number): void;
  resume(): void;
  pause(): void;
  toMenu(): void;
  setLocale(locale: Locale): void;
  toggleSound(): void;
  toggleMusic(): void;
  setVolume(volume: number): void;
  openShop(): void;
  closeShop(): void;
  buySkin(skinId: string): void;
  equipSkin(skinId: string): void;
  /** Called while typing, to keep the name saved. */
  typePlayerName(name: string): void;
  /** Called when the player leaves the field; returns the cleaned name that was kept. */
  commitPlayerName(name: string): string;
}

/** What the view needs to know about the campaign to draw the level picker and the field label. */
export interface CampaignView {
  readonly levelIds: readonly number[];
  /** Index of the level being played, or chosen on the menu. */
  readonly selected: number;
  readonly highestUnlocked: number;
  readonly biome: Biome;
  /** The crab types of the selected level, for the briefing. */
  readonly crabs: readonly { readonly type: CrabType; readonly points: number }[];
}

/** Small pictures drawn by the infrastructure layer: one per crab type, one per skin. */
export interface ViewIcons {
  crab(type: CrabType): HTMLElement;
  skin(skinId: string): HTMLElement;
}

type OverlayScreen = Exclude<Screen, 'playing'>;

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

/** Language and audio controls. They live inside the dialogs (menu, pause) to leave the field room. */
class SettingsPanel {
  readonly root = el('div', 'settings');
  private readonly label = el('span', 'settings__label');
  private readonly languages = new Map<Locale, HTMLButtonElement>();
  private readonly sound: HTMLButtonElement;
  private readonly music: HTMLButtonElement;
  private readonly volumeLabel = el('label', 'settings__label');
  private readonly volume = el('input', 'settings__volume');

  constructor(
    id: string,
    actions: Pick<ViewActions, 'setLocale' | 'toggleSound' | 'toggleMusic' | 'setVolume'>,
  ) {
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
    this.music = button('control', () => actions.toggleMusic());

    this.volume.id = `${id}-volume`;
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '100';
    this.volume.step = '5';
    this.volumeLabel.htmlFor = this.volume.id;
    this.volume.addEventListener('input', () => actions.setVolume(Number(this.volume.value) / 100));

    this.root.append(
      group,
      el('div', 'settings__group', this.sound, this.music),
      el('div', 'settings__volume-row', this.volumeLabel, this.volume),
    );
  }

  update(translator: Translator, audio: AudioSettings): void {
    const { t } = translator;
    this.label.textContent = t('settings.language');
    for (const [locale, b] of this.languages) {
      b.textContent = t(`language.${locale}`);
      b.setAttribute('aria-pressed', String(locale === translator.locale));
    }
    this.sound.textContent = t(audio.muted ? 'sound.off' : 'sound.on');
    this.sound.setAttribute('aria-pressed', String(!audio.muted));
    this.music.textContent = t(audio.music ? 'music.on' : 'music.off');
    this.music.setAttribute('aria-pressed', String(audio.music));
    this.volumeLabel.textContent = t('settings.volume');
    // Do not fight the thumb while it is being dragged.
    if (document.activeElement !== this.volume)
      this.volume.value = String(Math.round(audio.volume * 100));
  }
}

/**
 * A modal panel over the canvas: title, optional text, a few buttons and optional extras.
 * The first button that has a label is the primary action (and gets the focus); a button
 * without a label is hidden, so one overlay can offer different choices at different times.
 */
class Overlay {
  readonly root = el('div', 'overlay');
  private readonly heading = el('h2', 'overlay__title');
  private readonly body = el('p', 'overlay__text');
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(name: string, id: string) {
    this.root.dataset['overlay'] = name;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.heading.id = `${id}-title`;
    this.root.setAttribute('aria-labelledby', this.heading.id);
    this.root.hidden = true;
    this.root.append(this.heading, this.body);
  }

  addButton(onClick: () => void): void {
    const b = button('control', onClick);
    this.buttons.push(b);
    this.root.append(b);
  }

  /** Extra content (language/sound, level picker) goes after the buttons. */
  addExtra(node: Node): void {
    this.root.append(node);
  }

  setTexts(title: string, text: string, labels: readonly (string | undefined)[]): void {
    this.heading.textContent = title;
    this.body.textContent = text;
    this.body.hidden = text === '';
    const primary = labels.findIndex((label) => label !== undefined);
    this.buttons.forEach((b, index) => {
      const label = labels[index];
      b.hidden = label === undefined;
      if (label !== undefined) b.textContent = label;
      b.classList.toggle('control--primary', index === primary);
    });
  }

  focusPrimary(): void {
    this.buttons
      .find((b) => b.classList.contains('control--primary'))
      ?.focus({ preventScroll: true });
  }
}

/** The level picker on the menu: one numbered button per level, locked ones disabled. */
class LevelPicker {
  readonly root = el('div', 'levels');
  private readonly label = el('span', 'levels__label');
  private readonly group = el('div', 'levels__group');
  private readonly selectedName = el('p', 'levels__selected');
  private buttons: HTMLButtonElement[] = [];

  constructor(private readonly onSelect: (index: number) => void) {
    this.group.setAttribute('role', 'group');
    this.label.id = 'levels-label';
    this.group.setAttribute('aria-labelledby', this.label.id);
    this.selectedName.setAttribute('aria-live', 'polite');
    this.root.append(this.label, this.group, this.selectedName);
  }

  update(translator: Translator, campaign: CampaignView): void {
    const { t } = translator;
    if (this.buttons.length !== campaign.levelIds.length) {
      this.buttons = campaign.levelIds.map((_, index) =>
        button('control control--level', () => this.onSelect(index)),
      );
      this.group.replaceChildren(...this.buttons);
    }
    this.label.textContent = t('menu.levels');
    campaign.levelIds.forEach((id, index) => {
      const b = this.buttons[index];
      if (b === undefined) return;
      const locked = index > campaign.highestUnlocked;
      b.textContent = String(id);
      b.disabled = locked;
      b.setAttribute(
        'aria-label',
        locked
          ? t('menu.levelLocked', { level: id })
          : t('menu.levelOpen', { level: id, name: levelName(translator, id) }),
      );
      b.setAttribute('aria-pressed', String(index === campaign.selected));
    });
    const selectedId = campaign.levelIds[campaign.selected] ?? 1;
    this.selectedName.textContent = t('menu.selected', {
      level: selectedId,
      name: levelName(translator, selectedId),
    });
  }
}

/** The briefing's list of targets: a picture, a name and the points each one is worth. */
class TargetList {
  readonly root = el('ul', 'targets');

  constructor(private readonly icons: ViewIcons) {}

  update(translator: Translator, crabs: CampaignView['crabs']): void {
    const { t } = translator;
    this.root.replaceChildren(
      ...crabs.map(({ type, points }) => {
        const icon = el('span', 'targets__icon', this.icons.crab(type));
        icon.setAttribute('aria-hidden', 'true');
        const name = el('span', 'targets__name', t(crabNameKey(type)));
        const worth = el('span', 'targets__points', t('score.points', { count: points }));
        const item = el('li', 'targets__item', icon, el('span', 'targets__text', name, worth));
        item.dataset['crab'] = type;
        return item;
      }),
    );
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
  private audio: AudioSettings = { muted: false, music: true, volume: 1 };
  private screen: Screen = 'menu';
  private hasShownScreen = false;
  private outcome: RoundOutcome | undefined;
  private campaign: CampaignView | undefined;
  private lastHud: HudModel | undefined;
  private announceToggle = false;

  private readonly game = el('div', 'game');
  private readonly title = el('h1', 'sr-only');
  private readonly pauseButton: HTMLButtonElement;
  private readonly hud = el('div', 'hud');
  private readonly hudLevel = hudItem('level');
  private readonly hudName = el('p', 'hud__name');
  private readonly hudScore = hudItem('score');
  private readonly hudAmmo = hudItem('ammo');
  private readonly hudCombo = hudItem('combo');
  private readonly progress = el('progress', 'hud__progress');
  private readonly stage = el('div', 'stage');
  private readonly help = el('p', 'help');
  private readonly live = el('p', 'sr-only');

  private shopModel: ShopModel | undefined;
  private playerName = '';
  private readonly menu: Overlay;
  private readonly shop: Overlay;
  private readonly shopList: ShopList;
  private readonly nameField: NameField;
  private readonly briefing: Overlay;
  private readonly targets: TargetList;
  private readonly paused: Overlay;
  private readonly ended: Overlay;
  private readonly settings: readonly SettingsPanel[];
  private readonly levelPicker: LevelPicker;

  constructor(root: HTMLElement, actions: ViewActions, icons: ViewIcons) {
    // The "II" glyph is drawn by CSS: it is a picture, so the accessible name is just "Pause".
    this.pauseButton = button('control control--square control--pause', actions.pause);

    this.progress.max = 1;
    this.hud.append(
      this.hudLevel.root,
      this.hudName,
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

    this.levelPicker = new LevelPicker(actions.selectLevel);
    this.menu = new Overlay('menu', 'game-menu');
    this.nameField = new NameField(actions.typePlayerName, actions.commitPlayerName);
    this.menu.addButton(actions.play);
    this.menu.addButton(actions.openShop);
    this.menu.addExtra(this.levelPicker.root);
    this.menu.addExtra(this.nameField.root);
    this.menu.addExtra(menuSettings.root);
    this.shopList = new ShopList((id) => icons.skin(id), {
      buy: actions.buySkin,
      equip: actions.equipSkin,
    });
    this.shop = new Overlay('shop', 'game-shop');
    this.shop.addButton(actions.closeShop);
    this.shop.addExtra(this.shopList.root);
    this.targets = new TargetList(icons);
    this.briefing = new Overlay('briefing', 'game-briefing');
    this.briefing.addExtra(this.targets.root);
    this.briefing.addButton(actions.start);
    this.briefing.addButton(actions.toMenu);
    this.paused = new Overlay('paused', 'game-paused');
    this.paused.addButton(actions.resume);
    this.paused.addButton(actions.toMenu);
    this.paused.addExtra(pausedSettings.root);
    this.ended = new Overlay('ended', 'game-ended');
    this.ended.addButton(actions.next);
    this.ended.addButton(actions.retry);
    this.ended.addButton(actions.toMenu);

    this.stage.append(
      this.canvas,
      this.menu.root,
      this.shop.root,
      this.briefing.root,
      this.paused.root,
      this.ended.root,
    );
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

  /** Shows the current audio settings (sound, music, volume) in the settings panels. */
  setAudio(audio: AudioSettings): void {
    this.audio = audio;
    if (this.translator === undefined) return;
    for (const panel of this.settings) panel.update(this.translator, audio);
  }

  /** (Re)writes every static text. Call it whenever the language changes. */
  setTranslator(translator: Translator): void {
    this.translator = translator;
    this.lastHud = undefined;
    const { t } = translator;

    document.documentElement.lang = translator.locale;
    document.title = t('game.title');
    this.title.textContent = t('game.title');
    for (const panel of this.settings) panel.update(translator, this.audio);
    this.pauseButton.setAttribute('aria-label', t('pause.button'));
    this.hud.setAttribute('aria-label', t('game.title'));
    this.hudScore.label.textContent = t('hud.score');
    this.hudAmmo.label.textContent = t('hud.ammo');
    this.hudCombo.label.textContent = t('hud.combo');
    this.help.textContent = t('controls.help');

    this.menu.setTexts(t('game.title'), t('game.tagline'), [t('menu.play'), t('menu.shop')]);
    this.nameField.update(translator, this.playerName);
    this.renderShop();
    this.paused.setTexts(t('pause.title'), '', [t('pause.resume'), t('round.menu')]);
    this.renderCampaign();
    this.renderEnded();
    this.renderScreen();
  }

  showScreen(screen: Screen, outcome: RoundOutcome | undefined, campaign: CampaignView): void {
    const previous = this.screen;
    this.screen = screen;
    this.outcome = outcome;
    this.campaign = campaign;
    this.renderCampaign();
    this.renderEnded();
    this.renderScreen();
    if (previous !== screen || !this.hasShownScreen) this.moveFocus();
    this.hasShownScreen = true;
  }

  /** Copies the HUD strings to the DOM, touching only what changed. */
  updateHud(model: HudModel): void {
    const last = this.lastHud;
    if (last?.level !== model.level) this.hudLevel.value.textContent = model.level;
    if (last?.levelName !== model.levelName) this.hudName.textContent = model.levelName;
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

  /** The shop's contents and the name field follow the player's save. */
  updateProfile(shop: ShopModel, playerName: string): void {
    this.shopModel = shop;
    this.playerName = playerName;
    if (this.translator !== undefined) this.nameField.update(this.translator, playerName);
    this.renderShop();
  }

  /** The name of a skin in the current language, for announcements. */
  skinLabel(skinId: string): string {
    return this.translator === undefined ? skinId : skinName(this.translator, skinId);
  }

  private renderShop(): void {
    const { translator, shopModel } = this;
    if (translator === undefined || shopModel === undefined) return;
    const { t } = translator;
    this.shopList.update(translator, shopModel);
    this.shop.setTexts(
      t('shop.title'),
      t('shop.balance', { points: t('score.points', { count: shopModel.balance }) }),
      [t('shop.back')],
    );
  }

  private renderCampaign(): void {
    const { translator, campaign } = this;
    if (translator === undefined || campaign === undefined) return;
    const { t } = translator;
    this.levelPicker.update(translator, campaign);
    this.targets.update(translator, campaign.crabs);
    const levelId = campaign.levelIds[campaign.selected] ?? 1;
    this.briefing.setTexts(
      t('menu.selected', { level: levelId, name: levelName(translator, levelId) }),
      t('briefing.targets'),
      [t('briefing.start'), t('round.menu')],
    );
    this.canvas.setAttribute('aria-label', translator.t(canvasLabelKey(campaign.biome)));
  }

  private renderEnded(): void {
    const translator = this.translator;
    const outcome = this.outcome;
    if (translator === undefined || outcome === undefined) return;
    const { t } = translator;
    const won = outcome.result === 'won';
    const title = outcome.campaignComplete
      ? 'round.campaign.title'
      : won
        ? 'round.won.title'
        : 'round.lost.title';
    this.ended.setTexts(
      t(title),
      [
        t('round.summary', { score: outcome.score, hits: outcome.hits, throws: outcome.throws }),
        t('round.earned', { points: t('score.points', { count: outcome.score }) }),
        outcome.newBest
          ? t('round.newBest')
          : t('round.best', { points: t('score.points', { count: outcome.bestScore }) }),
      ].join('\n'),
      [
        outcome.nextLevelIndex === undefined ? undefined : t('round.next'),
        t(won ? 'round.again' : 'round.retry'),
        t('round.menu'),
      ],
    );
    this.ended.root.dataset['result'] = outcome.result;
  }

  private renderScreen(): void {
    const overlays: Readonly<Record<OverlayScreen, Overlay>> = {
      menu: this.menu,
      shop: this.shop,
      briefing: this.briefing,
      paused: this.paused,
      ended: this.ended,
    };
    for (const [name, overlay] of Object.entries(overlays) as [OverlayScreen, Overlay][]) {
      overlay.root.hidden = this.screen !== name;
    }
    const inRound = this.screen === 'playing' || this.screen === 'paused';
    // `visibility`, not `hidden`: the HUD keeps its space, so the canvas scale never jumps between
    // screens; it also removes the HUD from the accessibility tree while it is invisible.
    this.hud.style.visibility = this.screen === 'menu' || this.screen === 'shop' ? 'hidden' : '';
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
      case 'shop':
        this.shop.focusPrimary();
        break;
      case 'briefing':
        this.briefing.focusPrimary();
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
