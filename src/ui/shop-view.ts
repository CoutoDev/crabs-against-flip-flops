import { MAX_PLAYER_NAME_LENGTH } from '../application/player-name';
import { button, el } from './dom';
import type { Translator } from './i18n/translator';
import type { MessageKey } from './i18n/messages/en';

export interface ShopModel {
  readonly balance: number;
  readonly equipped: string;
  readonly owned: readonly string[];
  readonly skins: readonly { readonly id: string; readonly price: number }[];
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
 * The skins on sale: a picture, a name, a price and one button (Buy, Equip or Equipped). The rows
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
      const verb = equipped ? t('shop.equipped') : owned ? t('shop.equip') : t('shop.buy');

      item.name.textContent = name;
      item.price.textContent =
        skin.price === 0 ? t('shop.free') : t('score.points', { count: skin.price });
      item.action.textContent = verb;
      item.action.setAttribute('aria-label', t('shop.action', { action: verb, name }));
      item.action.disabled = equipped || (!owned && model.balance < skin.price);
      item.action.dataset['state'] = equipped ? 'equipped' : owned ? 'owned' : 'for-sale';
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
