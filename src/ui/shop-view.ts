import { MAX_PLAYER_NAME_LENGTH } from '../application/player-name';
import { achievementName } from './achievements-view';
import { button, el } from './dom';
import type { Translator } from './i18n/translator';
import type { MessageKey } from './i18n/messages/en';

export interface ShopModel {
  /** What the shop charges. */
  readonly coins: number;
  /** The point bank, waiting to be converted. */
  readonly points: number;
  /** How many coins the whole bank is worth now (0 below one coin's worth). */
  readonly convertibleCoins: number;
  readonly pointsPerCoin: number;
  readonly equipped: string;
  readonly owned: readonly string[];
  /**
   * Prices are in coins. A skin with no price is earned, never sold: `earnedBy` is the
   * achievement that gives it, shown as a hint while the skin is still locked.
   */
  readonly skins: readonly {
    readonly id: string;
    readonly price: number | undefined;
    readonly earnedBy: string | undefined;
  }[];
}

export interface ShopActions {
  buy(skinId: string): void;
  equip(skinId: string): void;
}

export const skinNameKey = (skinId: string): MessageKey => `skins.${skinId}.name` as MessageKey;
export const skinName = (translator: Translator, skinId: string): string =>
  translator.t(skinNameKey(skinId));

interface ShopItem {
  readonly name: HTMLElement;
  readonly price: HTMLElement;
  readonly action: HTMLButtonElement;
}

/**
 * The point bank and the button that turns it into coins (D38). The button is never really
 * `disabled`: a disabled button that was just pressed loses the keyboard focus, and converting
 * everything is exactly what empties the bank. It says "disabled" with `aria-disabled` instead.
 */
export class BankPanel {
  readonly root = el('section', 'bank');
  private readonly points = el('p', 'bank__points');
  private readonly worth = el('p', 'bank__worth');
  private readonly convert: HTMLButtonElement;
  private canConvert = false;

  constructor(onConvert: () => void) {
    this.convert = button('control bank__convert', () => {
      if (this.canConvert) onConvert();
    });
    this.root.append(this.points, this.worth, this.convert);
  }

  update(translator: Translator, model: ShopModel): void {
    const { t } = translator;
    this.points.textContent = t('shop.bank', {
      points: t('score.points', { count: model.points }),
    });
    this.worth.textContent = t('shop.bankWorth', {
      coins: t('score.coins', { count: model.convertibleCoins }),
      rate: model.pointsPerCoin,
    });
    this.canConvert = model.convertibleCoins > 0;
    this.convert.textContent = t('shop.convert');
    this.convert.setAttribute('aria-disabled', String(!this.canConvert));
  }
}

/**
 * The skins: a picture, a name, a price (or how to earn it) and one button (Buy, Equip, Equipped
 * or Locked). The rows
 * are built once and then only updated, so the button the player just pressed keeps its focus
 * while it turns from Buy into Equip.
 */
export class ShopList {
  readonly root = el('ul', 'skins');
  private readonly items = new Map<string, ShopItem>();

  constructor(
    private readonly icon: (skinId: string) => HTMLElement,
    private readonly actions: ShopActions,
  ) {}

  update(translator: Translator, model: ShopModel): void {
    const { t } = translator;
    for (const skin of model.skins) {
      const item = this.items.get(skin.id) ?? this.build(skin.id);
      const owned = model.owned.includes(skin.id);
      const equipped = model.equipped === skin.id;
      const name = skinName(translator, skin.id);
      const locked = !owned && skin.price === undefined;
      const verb = equipped
        ? t('shop.equipped')
        : owned
          ? t('shop.equip')
          : locked
            ? t('shop.locked')
            : t('shop.buy');

      item.name.textContent = name;
      item.price.textContent =
        skin.price === undefined
          ? skin.earnedBy === undefined
            ? ''
            : t('shop.earnedBy', { name: achievementName(translator, skin.earnedBy) })
          : skin.price === 0
            ? t('shop.free')
            : t('score.coins', { count: skin.price });
      item.action.textContent = verb;
      item.action.setAttribute('aria-label', t('shop.action', { action: verb, name }));
      item.action.disabled =
        equipped || locked || (!owned && skin.price !== undefined && model.coins < skin.price);
      item.action.dataset['state'] = equipped
        ? 'equipped'
        : owned
          ? 'owned'
          : locked
            ? 'locked'
            : 'for-sale';
    }
  }

  private build(skinId: string): ShopItem {
    const name = el('span', 'skins__name');
    const price = el('span', 'skins__price');
    const action = button('control skins__action', () => {
      if (action.dataset['state'] === 'owned') this.actions.equip(skinId);
      else if (action.dataset['state'] === 'for-sale') this.actions.buy(skinId);
    });
    const picture = el('span', 'skins__icon', this.icon(skinId));
    picture.setAttribute('aria-hidden', 'true');
    const row = el('li', 'skins__item', picture, el('span', 'skins__text', name, price), action);
    row.dataset['skin'] = skinId;
    this.root.append(row);
    const item = { name, price, action };
    this.items.set(skinId, item);
    return item;
  }
}

/** The player's name: optional, saved as they type, cleaned when they leave the field. */
export class NameField {
  readonly root = el('div', 'name-field');
  private readonly label = el('label', 'name-field__label');
  private readonly input = el('input', 'name-field__input');

  constructor(onInput: (value: string) => void, onCommit: (value: string) => string) {
    this.input.id = 'player-name';
    this.input.type = 'text';
    this.input.maxLength = MAX_PLAYER_NAME_LENGTH * 2; // typing room; the cleaned name is cut to 16
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.setAttribute('autocapitalize', 'words');
    this.label.htmlFor = this.input.id;
    this.input.addEventListener('input', () => onInput(this.input.value));
    this.input.addEventListener('change', () => {
      this.input.value = onCommit(this.input.value);
    });
    this.root.append(this.label, this.input);
  }

  update(translator: Translator, name: string): void {
    this.label.textContent = translator.t('menu.name');
    this.input.placeholder = translator.t('menu.namePlaceholder');
    if (document.activeElement !== this.input) this.input.value = name;
  }
}
