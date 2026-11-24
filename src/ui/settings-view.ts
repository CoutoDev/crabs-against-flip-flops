import { LOCALES, type Locale } from '../application/locale';
import { button, el } from './dom';
import type { Translator } from './i18n/translator';
import type { MessageKey } from './i18n/messages/en';
import { icon, type IconName } from './icons';

/** What the audio screen shows and changes. */
export interface AudioSettings {
  readonly muted: boolean;
  readonly music: boolean;
  /** 0..1 */
  readonly volume: number;
}

export interface AudioActions {
  toggleSound(): void;
  toggleMusic(): void;
  setVolume(volume: number): void;
  /** The slider was released: time to store the volume. */
  commitVolume(): void;
}

let nextId = 0;
const uid = (prefix: string): string => `${prefix}-${nextId++}`;

/**
 * A big on/off row, like the switches of a phone's settings: icon, name and a track with a knob.
 * The whole row is the button (a thumb-sized target); the "On"/"Off" under the name says the state
 * in words as well as by the knob's position and the track's color.
 */
class SwitchRow {
  readonly root: HTMLButtonElement;
  private readonly label = el('span', 'switch__label');
  private readonly state = el('span', 'switch__state');
  private readonly iconSlot = el('span', 'switch__icon');
  private iconName: IconName | undefined;

  constructor(onToggle: () => void) {
    this.root = button('switch', onToggle);
    this.root.setAttribute('role', 'switch');
    this.label.id = uid('switch-label');
    // The name is the label alone; the state is announced as "on"/"off" by the switch role.
    this.root.setAttribute('aria-labelledby', this.label.id);
    const track = el('span', 'switch__track', el('span', 'switch__knob'));
    track.setAttribute('aria-hidden', 'true');
    this.root.append(this.iconSlot, el('span', 'switch__text', this.label, this.state), track);
  }

  update(label: string, on: boolean, stateText: string, iconName: IconName): void {
    this.label.textContent = label;
    this.state.textContent = stateText;
    this.root.setAttribute('aria-checked', String(on));
    if (iconName !== this.iconName) {
      this.iconName = iconName;
      this.iconSlot.replaceChildren(icon(iconName));
    }
  }
}

/** The audio screen: sound effects and music switches, and a thumb-friendly volume slider. */
export class AudioPanel {
  readonly root = el('div', 'settings');
  private readonly sound: SwitchRow;
  private readonly music: SwitchRow;
  private readonly volumeLabel = el('label', 'volume__label');
  private readonly volumeValue = el('span', 'volume__value');
  private readonly volume = el('input', 'volume__slider');

  constructor(actions: AudioActions) {
    this.sound = new SwitchRow(actions.toggleSound);
    this.music = new SwitchRow(actions.toggleMusic);

    this.volume.id = 'audio-volume';
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '100';
    this.volume.step = '5';
    this.volumeLabel.htmlFor = this.volume.id;
    this.volumeValue.setAttribute('aria-hidden', 'true');
    this.volume.addEventListener('input', () => {
      this.showVolume(Number(this.volume.value));
      actions.setVolume(Number(this.volume.value) / 100);
    });
    this.volume.addEventListener('change', () => actions.commitVolume());

    const volumeCard = el(
      'div',
      'volume',
      el('div', 'volume__head', icon('speaker'), this.volumeLabel, this.volumeValue),
      this.volume,
    );
    this.root.append(this.sound.root, this.music.root, volumeCard);
  }

  /** The control that gets the focus when the screen opens. */
  get firstControl(): HTMLElement {
    return this.sound.root;
  }

  update(translator: Translator, audio: AudioSettings): void {
    const { t } = translator;
    const stateText = (on: boolean): string => t(on ? 'audio.on' : 'audio.off');
    this.sound.update(
      t('audio.sound'),
      !audio.muted,
      stateText(!audio.muted),
      audio.muted ? 'speakerOff' : 'speaker',
    );
    this.music.update(t('audio.music'), audio.music, stateText(audio.music), 'music');
    this.volumeLabel.textContent = t('settings.volume');
    // Do not fight the thumb while it is being dragged.
    if (document.activeElement !== this.volume) {
      this.volume.value = String(Math.round(audio.volume * 100));
    }
    this.showVolume(Math.round(audio.volume * 100));
  }

  private showVolume(percent: number): void {
    this.volumeValue.textContent = `${percent}%`;
    this.volume.setAttribute('aria-valuetext', `${percent}%`);
    this.volume.style.setProperty('--fill', `${percent}%`);
  }
}

/** The language screen: one big card per language, the current one marked with a check. */
export class LanguagePanel {
  readonly root = el('div', 'languages');
  private readonly cards = new Map<Locale, HTMLButtonElement>();

  constructor(onSelect: (locale: Locale) => void) {
    this.root.setAttribute('role', 'group');
    for (const locale of LOCALES) {
      const card = button('language', () => onSelect(locale));
      card.lang = locale;
      const badge = el('span', 'language__badge', locale.slice(0, 2).toUpperCase());
      badge.setAttribute('aria-hidden', 'true');
      const name = el('span', 'language__name');
      const mark = el('span', 'language__mark', icon('check'));
      card.append(badge, name, mark);
      this.cards.set(locale, card);
      this.root.append(card);
    }
  }

  /** The control that gets the focus when the screen opens: the language in use. */
  firstControl(current: Locale): HTMLElement | undefined {
    return this.cards.get(current);
  }

  update(translator: Translator): void {
    this.root.setAttribute('aria-label', translator.t('language.current'));
    for (const [locale, card] of this.cards) {
      const name = card.querySelector('.language__name');
      if (name !== null) name.textContent = translator.t(`language.${locale}` as MessageKey);
      card.setAttribute('aria-pressed', String(locale === translator.locale));
    }
  }
}

/** A square icon button with a caption under it (the "dock" of the menu and of the pause). */
export interface Tile {
  readonly root: HTMLButtonElement;
  setCaption(text: string): void;
}

export function tile(iconName: IconName, name: string, onClick: () => void): Tile {
  const caption = el('span', 'tile__caption');
  const root = button('tile', onClick);
  root.dataset['tile'] = name;
  root.append(el('span', 'tile__icon', icon(iconName)), caption);
  return {
    root,
    setCaption: (text) => {
      caption.textContent = text;
    },
  };
}
