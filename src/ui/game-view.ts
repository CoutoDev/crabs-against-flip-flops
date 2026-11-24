import type { RoundOutcome, Screen, SettingsOrigin } from '../application/game-flow';
import type { Locale } from '../application/locale';
import type { CrabType } from '../domain/entities/crab';
import type { Biome } from '../domain/entities/level';
import {
  AchievementList,
  achievementName,
  rewardText,
  type AchievementsModel,
  type RewardView,
} from './achievements-view';
import { canvasLabelKey, crabNameKey, levelName } from './campaign-text';
import { button, el } from './dom';
import type { HudModel } from './hud-model';
import type { Translator } from './i18n/translator';
import { icon, type IconName } from './icons';
import { AudioPanel, LanguagePanel, tile, type AudioSettings, type Tile } from './settings-view';
import { BankPanel, NameField, ShopList, skinName, type ShopModel } from './shop-view';

export type { AudioSettings } from './settings-view';

export interface ViewActions {
  play(): void;
  start(): void;
  retry(): void;
  next(): void;
  selectLevel(index: number): void;
  resume(): void;
  pause(): void;
  toMenu(): void;
  openAudio(): void;
  openLanguage(): void;
  /** Back from the audio or language screen. */
  closeSettings(): void;
  setLocale(locale: Locale): void;
  toggleSound(): void;
  toggleMusic(): void;
  setVolume(volume: number): void;
  /** The slider was released: time to store the volume. */
  commitVolume(): void;
  openShop(): void;
  closeShop(): void;
  openAchievements(): void;
  closeAchievements(): void;
  buySkin(skinId: string): void;
  /** Turns the whole point bank into coins. */
  convertPoints(): void;
  equipSkin(skinId: string): void;
  /** Called while typing, to keep the name saved. */
  typePlayerName(name: string): void;
  /** Called when the player leaves the field; returns the cleaned name that was kept. */
  commitPlayerName(name: string): string;
}

/** What the last round put in the point bank, for the end-of-round dialog. */
export interface RoundCreditView {
  readonly points: number;
  /** True when the replay rule cut it, so the dialog says why. */
  readonly reduced: boolean;
  /** The share that counts on a level already cleared (for the explanation). */
  readonly replayPercent: number;
  /** Achievements this round earned, in the order they were earned. */
  readonly unlocked: readonly { readonly id: string; readonly reward: RewardView }[];
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

/**
 * A modal panel over the canvas: title, optional text, a few buttons and optional extras, in the
 * order they were added. The first button that has a label is the primary action (and gets the
 * focus) unless the overlay says otherwise; a button without a label is hidden, so one overlay can
 * offer different choices at different times.
 */
class Overlay {
  readonly root = el('div', 'overlay');
  /** Where the focus goes when the screen opens, if not on the primary button. */
  initialFocus: (() => HTMLElement | undefined) | undefined;
  private readonly heading = el('h2', 'overlay__title');
  private readonly body = el('p', 'overlay__text');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly labels: HTMLElement[] = [];

  constructor(
    name: string,
    id: string,
    private readonly hasPrimary = true,
  ) {
    this.root.dataset['overlay'] = name;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.heading.id = `${id}-title`;
    this.root.setAttribute('aria-labelledby', this.heading.id);
    this.root.hidden = true;
    this.root.append(this.heading, this.body);
  }

  /** A big picture above the title, for the screens that are not part of a round. */
  setBadge(name: IconName): void {
    this.root.prepend(el('div', 'overlay__badge', icon(name)));
  }

  addButton(onClick: () => void, iconName?: IconName, extraClass = ''): HTMLButtonElement {
    const b = button(`control ${extraClass}`.trim(), onClick);
    this.buttons.push(b);
    if (iconName === undefined) {
      this.labels.push(b);
    } else {
      const label = el('span', 'control__label');
      this.labels.push(label);
      b.append(icon(iconName), label);
    }
    this.root.append(b);
    return b;
  }

  /** Extra content (dock, level picker, switches) goes where it is added among the buttons. */
  addExtra(node: Node): void {
    this.root.append(node);
  }

  setTexts(title: string, text: string, labels: readonly (string | undefined)[]): void {
    this.heading.textContent = title;
    this.body.textContent = text;
    this.body.hidden = text === '';
    const primary = this.hasPrimary ? labels.findIndex((label) => label !== undefined) : -1;
    this.buttons.forEach((b, index) => {
      const label = labels[index];
      b.hidden = label === undefined;
      const target = this.labels[index];
      if (label !== undefined && target !== undefined) target.textContent = label;
      b.classList.toggle('control--primary', index === primary);
    });
  }

  focusPrimary(): void {
    const target =
      this.initialFocus?.() ?? this.buttons.find((b) => b.classList.contains('control--primary'));
    target?.focus({ preventScroll: true });
  }
}

/** A row of icon buttons with captions, like the bottom bar of a mobile game. */
class Dock {
  readonly root = el('div', 'dock');

  constructor(readonly tiles: readonly Tile[]) {
    this.root.append(...tiles.map((t) => t.root));
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
  private origin: SettingsOrigin = 'menu';
  private hasShownScreen = false;
  private outcome: RoundOutcome | undefined;
  private credit: RoundCreditView | undefined;
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
  private achievementsModel: AchievementsModel | undefined;
  private playerName = '';
  private readonly menu: Overlay;
  private readonly shop: Overlay;
  private readonly shopList: ShopList;
  private readonly achievementsScreen: Overlay;
  private readonly achievementList: AchievementList;
  private readonly bank: BankPanel;
  private readonly nameField: NameField;
  private readonly briefing: Overlay;
  private readonly targets: TargetList;
  private readonly paused: Overlay;
  private readonly ended: Overlay;
  private readonly audioScreen: Overlay;
  private readonly languageScreen: Overlay;
  private readonly audioPanel: AudioPanel;
  private readonly languagePanel: LanguagePanel;
  private readonly menuDock: Dock;
  private readonly pausedDock: Dock;
  private readonly menuTiles: Readonly<
    Record<'shop' | 'achievements' | 'audio' | 'language', Tile>
  >;
  private readonly pausedTiles: Readonly<Record<'audio' | 'language', Tile>>;
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

    this.audioPanel = new AudioPanel(actions);
    this.languagePanel = new LanguagePanel(actions.setLocale);
    this.menuTiles = {
      shop: tile('cart', 'shop', actions.openShop),
      achievements: tile('trophy', 'achievements', actions.openAchievements),
      audio: tile('speaker', 'audio', actions.openAudio),
      language: tile('globe', 'language', actions.openLanguage),
    };
    this.pausedTiles = {
      audio: tile('speaker', 'audio', actions.openAudio),
      language: tile('globe', 'language', actions.openLanguage),
    };
    this.menuDock = new Dock(Object.values(this.menuTiles));
    this.pausedDock = new Dock(Object.values(this.pausedTiles));

    this.levelPicker = new LevelPicker(actions.selectLevel);
    this.menu = new Overlay('menu', 'game-menu');
    this.nameField = new NameField(actions.typePlayerName, actions.commitPlayerName);
    // The big actions come first, so they are on screen even on a small phone; the name last.
    this.menu.addButton(actions.play, 'play');
    this.menu.addExtra(this.menuDock.root);
    this.menu.addExtra(this.levelPicker.root);
    this.menu.addExtra(this.nameField.root);
    this.bank = new BankPanel(actions.convertPoints);
    this.shopList = new ShopList((id) => icons.skin(id), {
      buy: actions.buySkin,
      equip: actions.equipSkin,
    });
    this.shop = new Overlay('shop', 'game-shop', false);
    this.shop.setBadge('cart');
    // Back is at the top, where it is found without scrolling the list of skins.
    const shopBack = this.shop.addButton(actions.closeShop, 'back', 'control--back');
    this.shop.initialFocus = () => shopBack;
    this.shop.addExtra(this.bank.root);
    this.shop.addExtra(this.shopList.root);
    this.achievementList = new AchievementList((id) => skinName(this.requireTranslator(), id));
    this.achievementsScreen = new Overlay('achievements', 'game-achievements', false);
    this.achievementsScreen.setBadge('trophy');
    const achievementsBack = this.achievementsScreen.addButton(
      actions.closeAchievements,
      'back',
      'control--back',
    );
    this.achievementsScreen.initialFocus = () => achievementsBack;
    this.achievementsScreen.addExtra(this.achievementList.root);
    this.targets = new TargetList(icons);
    this.briefing = new Overlay('briefing', 'game-briefing');
    this.briefing.addExtra(this.targets.root);
    this.briefing.addButton(actions.start, 'play');
    this.briefing.addButton(actions.toMenu);
    this.paused = new Overlay('paused', 'game-paused');
    this.paused.addButton(actions.resume, 'play');
    this.paused.addExtra(this.pausedDock.root);
    this.paused.addButton(actions.toMenu);
    this.ended = new Overlay('ended', 'game-ended');
    this.ended.addButton(actions.next);
    this.ended.addButton(actions.retry);
    this.ended.addButton(actions.toMenu);

    // Audio and language: a screen each, with a thumb-sized Back at the bottom.
    this.audioScreen = new Overlay('audio', 'game-audio', false);
    this.audioScreen.setBadge('speaker');
    this.audioScreen.addExtra(this.audioPanel.root);
    this.audioScreen.addButton(actions.closeSettings, 'back', 'control--back');
    this.audioScreen.initialFocus = () => this.audioPanel.firstControl;
    this.languageScreen = new Overlay('language', 'game-language', false);
    this.languageScreen.setBadge('globe');
    this.languageScreen.addExtra(this.languagePanel.root);
    this.languageScreen.addButton(actions.closeSettings, 'back', 'control--back');
    this.languageScreen.initialFocus = () =>
      this.translator === undefined
        ? undefined
        : this.languagePanel.firstControl(this.translator.locale);

    this.stage.append(
      this.canvas,
      this.menu.root,
      this.shop.root,
      this.achievementsScreen.root,
      this.briefing.root,
      this.paused.root,
      this.ended.root,
      this.audioScreen.root,
      this.languageScreen.root,
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

  /** Shows the current audio settings (sound, music, volume) on the audio screen. */
  setAudio(audio: AudioSettings): void {
    this.audio = audio;
    if (this.translator === undefined) return;
    this.audioPanel.update(this.translator, audio);
  }

  /** (Re)writes every static text. Call it whenever the language changes. */
  setTranslator(translator: Translator): void {
    this.translator = translator;
    this.lastHud = undefined;
    const { t } = translator;

    document.documentElement.lang = translator.locale;
    document.title = t('game.title');
    this.title.textContent = t('game.title');
    this.audioPanel.update(translator, this.audio);
    this.languagePanel.update(translator);
    this.menuTiles.shop.setCaption(t('menu.shop'));
    this.menuTiles.achievements.setCaption(t('menu.achievements'));
    this.menuTiles.audio.setCaption(t('menu.audio'));
    this.menuTiles.language.setCaption(t('settings.language'));
    this.pausedTiles.audio.setCaption(t('menu.audio'));
    this.pausedTiles.language.setCaption(t('settings.language'));
    this.pauseButton.setAttribute('aria-label', t('pause.button'));
    this.hud.setAttribute('aria-label', t('game.title'));
    this.hudScore.label.textContent = t('hud.score');
    this.hudAmmo.label.textContent = t('hud.ammo');
    this.hudCombo.label.textContent = t('hud.combo');
    this.help.textContent = t('controls.help');

    this.menu.setTexts(t('game.title'), t('game.tagline'), [t('menu.play')]);
    this.audioScreen.setTexts(t('audio.title'), '', [t('settings.back')]);
    this.languageScreen.setTexts(t('language.title'), '', [t('settings.back')]);
    this.nameField.update(translator, this.playerName);
    this.renderShop();
    this.renderAchievements();
    this.paused.setTexts(t('pause.title'), '', [t('pause.resume'), t('round.menu')]);
    this.renderCampaign();
    this.renderEnded();
    this.renderScreen();
  }

  showScreen(
    screen: Screen,
    outcome: RoundOutcome | undefined,
    campaign: CampaignView,
    settingsOrigin: SettingsOrigin = 'menu',
  ): void {
    const previous = this.screen;
    this.screen = screen;
    this.origin = settingsOrigin;
    this.outcome = outcome;
    this.campaign = campaign;
    this.renderCampaign();
    this.renderEnded();
    this.renderScreen();
    if (previous !== screen || !this.hasShownScreen) this.moveFocus(previous);
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

  /** The achievements screen follows the player's save. */
  updateAchievements(model: AchievementsModel): void {
    this.achievementsModel = model;
    this.renderAchievements();
  }

  /** Set when a round ends, before the end dialog is shown. */
  setRoundCredit(credit: RoundCreditView): void {
    this.credit = credit;
  }

  private creditText(outcome: RoundOutcome, t: Translator['t']): string {
    const credit = this.credit ?? {
      points: outcome.score,
      reduced: false,
      replayPercent: 100,
      unlocked: [],
    };
    const points = t('score.points', { count: credit.points });
    return credit.reduced
      ? t('round.earnedReduced', { points, percent: credit.replayPercent })
      : t('round.earned', { points });
  }

  /** One line per achievement the round earned: its name and what it paid. */
  private unlockedLines(translator: Translator): string[] {
    return (this.credit?.unlocked ?? []).map(({ id, reward }) =>
      translator.t('round.unlocked', {
        name: achievementName(translator, id),
        reward: rewardText(translator, reward, (skinId) => skinName(translator, skinId)),
      }),
    );
  }

  private requireTranslator(): Translator {
    if (this.translator === undefined) throw new Error('The view has no translator yet');
    return this.translator;
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
    this.bank.update(translator, shopModel);
    this.shop.setTexts(
      t('shop.title'),
      t('shop.balance', { coins: t('score.coins', { count: shopModel.coins }) }),
      [t('shop.back')],
    );
  }

  private renderAchievements(): void {
    const { translator, achievementsModel } = this;
    if (translator === undefined || achievementsModel === undefined) return;
    const { t } = translator;
    this.achievementList.update(translator, achievementsModel);
    const earned = achievementsModel.rows.filter((row) => row.earned).length;
    this.achievementsScreen.setTexts(
      t('achievements.title'),
      t('achievements.summary', { earned, total: achievementsModel.rows.length }),
      [t('achievements.back')],
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
        this.creditText(outcome, t),
        ...this.unlockedLines(translator),
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
      achievements: this.achievementsScreen,
      audio: this.audioScreen,
      language: this.languageScreen,
      briefing: this.briefing,
      paused: this.paused,
      ended: this.ended,
    };
    for (const [name, overlay] of Object.entries(overlays) as [OverlayScreen, Overlay][]) {
      overlay.root.hidden = this.screen !== name;
    }
    const inSettings = this.screen === 'audio' || this.screen === 'language';
    // The pause screen's own audio and language screens still belong to the round.
    const inRound =
      this.screen === 'playing' ||
      this.screen === 'paused' ||
      (inSettings && this.origin === 'paused');
    // `visibility`, not `hidden`: the HUD keeps its space, so the canvas scale never jumps between
    // screens; it also removes the HUD from the accessibility tree while it is invisible.
    this.hud.style.visibility =
      inRound || this.screen === 'briefing' || this.screen === 'ended' ? '' : 'hidden';
    this.pauseButton.style.visibility = inRound ? '' : 'hidden';
    this.pauseButton.disabled = this.screen !== 'playing';
    this.stage.dataset['screen'] = this.screen;
  }

  /** After coming back from the shop, audio or language, the focus returns to the button that opened it. */
  private returnFocusTarget(previous: Screen): HTMLElement | undefined {
    const tiles = this.screen === 'paused' ? this.pausedTiles : this.menuTiles;
    if (previous === 'audio') return tiles.audio.root;
    if (previous === 'language') return tiles.language.root;
    if (previous === 'shop' && this.screen === 'menu') return this.menuTiles.shop.root;
    if (previous === 'achievements' && this.screen === 'menu') {
      return this.menuTiles.achievements.root;
    }
    return undefined;
  }

  private moveFocus(previous: Screen): void {
    const back = this.returnFocusTarget(previous);
    if ((this.screen === 'menu' || this.screen === 'paused') && back !== undefined) {
      back.focus({ preventScroll: true });
      return;
    }
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
      case 'achievements':
        this.achievementsScreen.focusPrimary();
        break;
      case 'audio':
        this.audioScreen.focusPrimary();
        break;
      case 'language':
        this.languageScreen.focusPrimary();
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
