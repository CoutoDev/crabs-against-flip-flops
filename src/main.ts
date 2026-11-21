import './style.css';
import { LOCALES, type Locale } from './application/locale';
import { detectLocale } from './ui/i18n/detect-locale';
import { createTranslator, type Translator } from './ui/i18n/translator';

/**
 * Composition root. M0 only renders a localized shell to prove the toolchain and i18n end to end;
 * the game itself starts in M1 (domain) / M2 (canvas).
 * The chosen locale is not persisted yet: that arrives with the progress repository (M4).
 */
const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('Missing #app root element');
const app: HTMLElement = root;

function render(root: HTMLElement, translator: Translator, onLocaleChange: (l: Locale) => void) {
  document.documentElement.lang = translator.locale;
  document.title = translator.t('game.title');

  const title = document.createElement('h1');
  title.textContent = translator.t('game.title');

  const tagline = document.createElement('p');
  tagline.textContent = translator.t('game.tagline');

  const switcher = document.createElement('div');
  switcher.className = 'locale-switcher';
  switcher.setAttribute('role', 'group');
  const label = document.createElement('span');
  label.textContent = translator.t('settings.language');
  label.id = 'locale-label';
  switcher.setAttribute('aria-labelledby', label.id);
  switcher.append(label);

  for (const locale of LOCALES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.lang = locale;
    button.textContent = translator.t(`language.${locale}`);
    button.setAttribute('aria-pressed', String(locale === translator.locale));
    button.addEventListener('click', () => onLocaleChange(locale));
    switcher.append(button);
  }

  root.replaceChildren(title, tagline, switcher);
}

function start(locale: Locale) {
  render(app, createTranslator(locale), start);
}

start(detectLocale(navigator.languages));
