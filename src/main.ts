import './style.css';
import { EventBus } from './application/event-bus';
import { musicFor } from './application/music-policy';
import { Profile } from './application/profile';
import { GameFlow } from './application/game-flow';
import { PlayerControls } from './application/player-controls';
import { CRAB_TYPES } from './data/crab-types';
import { LEVELS } from './data/levels';
import { DEFAULT_SKIN_ID, SKINS } from './data/skins';
import { FIELD_HEIGHT_PX, FIELD_WIDTH_PX } from './domain/constants';
import type { DomainEvent } from './domain/events';
import { createRng } from './domain/rng';
import { bindSfx } from './infrastructure/audio/bind-sfx';
import { WebAudioMusic } from './infrastructure/audio/web-audio-music';
import { WebAudioSfx } from './infrastructure/audio/web-audio-sfx';
import { startGameLoop } from './infrastructure/browser/game-loop';
import { bindKeyboard, bindPointer } from './infrastructure/input/dom-input';
import { CanvasPresenter } from './infrastructure/render/canvas-presenter';
import { Effects } from './infrastructure/render/effects';
import { Framebuffer } from './infrastructure/render/framebuffer';
import { Scene } from './infrastructure/render/scene';
import { slotsForSkin, trailForSkin } from './infrastructure/render/skin-slots';
import {
  browserStorage,
  LocalStorageProgressRepository,
} from './infrastructure/storage/local-storage-progress-repository';
import { spriteToCanvas } from './infrastructure/render/sprite-canvas';
import { SPRITES } from './infrastructure/render/sprites';
import { announcementFor } from './ui/announce';
import { GameView, type CampaignView, type ViewIcons } from './ui/game-view';
import { buildHud } from './ui/hud-model';
import { detectLocale } from './ui/i18n/detect-locale';
import { createTranslator } from './ui/i18n/translator';

/**
 * Composition root: the only place that knows every layer. It creates the objects, wires them
 * together and owns the few pieces of impure state (random seeds, the audio context, the DOM).
 * The chosen locale and the mute choice are not persisted yet: that arrives with the progress
 * repository (M4).
 */
const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('Missing #app root element');

const profile = new Profile(
  new LocalStorageProgressRepository(browserStorage),
  {
    levelIds: LEVELS.map((level) => level.id),
    skinIds: SKINS.map((skin) => skin.id),
    defaultSkin: DEFAULT_SKIN_ID,
  },
  SKINS,
);
const bus = new EventBus<DomainEvent>();
const flow = new GameFlow({
  progress: profile.progress,
  levels: LEVELS,
  crabSpecs: CRAB_TYPES,
  newSeed: () => Math.floor(Math.random() * 0x100000000),
  bus,
});
const controls = new PlayerControls(flow);
const sfx = new WebAudioSfx();
const music = new WebAudioMusic(() => sfx.graph);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const effects = new Effects({
  rng: createRng(Math.floor(Math.random() * 0x100000000)),
  reducedMotion: () => reducedMotion.matches,
});
const scene = new Scene();
const frame = new Framebuffer(FIELD_WIDTH_PX, FIELD_HEIGHT_PX);

let translator = createTranslator(
  profile.data.settings.locale ?? detectLocale(navigator.languages),
);
let hudKey = '';

const icons: ViewIcons = {
  crab: (type) => spriteToCanvas(SPRITES.crabs[type][0]),
  // The flip flop lying flat (rotated) so it reads as a shoe in the shop.
  skin: (skinId) => spriteToCanvas(SPRITES.slipper[1], slotsForSkin(skinId)),
};

const view = new GameView(
  root,
  {
    play: () => {
      void sfx.unlock(); // browsers only start audio after a user gesture, and this is one
      effects.clear();
      flow.play();
    },
    start: () => {
      void sfx.unlock();
      flow.start();
    },
    retry: () => {
      void sfx.unlock();
      effects.clear();
      flow.retry();
    },
    next: () => {
      void sfx.unlock();
      effects.clear();
      flow.next();
    },
    selectLevel: (index) => flow.select(index),
    openShop: () => flow.openShop(),
    closeShop: () => flow.closeShop(),
    buySkin: (skinId) => {
      if (profile.buy(skinId) === undefined) {
        sfx.play({ id: 'buy', semitones: 0 });
        view.announce(translator.t('shop.bought', { name: view.skinLabel(skinId) }));
      }
    },
    equipSkin: (skinId) => {
      if (profile.equip(skinId) === undefined) {
        sfx.play({ id: 'equip', semitones: 0 });
        view.announce(translator.t('shop.nowUsing', { name: view.skinLabel(skinId) }));
      }
    },
    typePlayerName: (name) => void profile.setPlayerName(name),
    commitPlayerName: (name) => profile.setPlayerName(name),
    resume: () => flow.resume(),
    pause: () => flow.pause(),
    toMenu: () => flow.toMenu(),
    setLocale: (locale) => {
      translator = createTranslator(locale);
      profile.setLocale(locale);
      hudKey = '';
      view.setTranslator(translator);
      refit();
    },
    toggleSound: () => profile.setMuted(!profile.data.settings.muted),
    toggleMusic: () => profile.setMusic(!profile.data.settings.music),
    setVolume: (volume) => profile.setVolume(volume),
  },
  icons,
);
const presenter = new CanvasPresenter(view.canvas, frame);

function refit(): void {
  const { width, height } = view.availableSize();
  presenter.fit(width, height, window.devicePixelRatio);
}

bindSfx(bus, sfx);
bus.subscribe((event) => effects.handle(event));
bus.subscribe((event) => {
  const message = announcementFor(event, translator);
  if (message !== undefined) view.announce(message);
});

function campaignView(): CampaignView {
  const level = LEVELS[flow.levelIndex];
  return {
    levelIds: LEVELS.map((level) => level.id),
    selected: flow.levelIndex,
    highestUnlocked: flow.highestUnlockedIndex,
    biome: level?.biome ?? 'beach',
    crabs: (level?.crabs ?? []).map(({ type }) => ({ type, points: CRAB_TYPES[type].points })),
  };
}

function pushProfile(): void {
  const { balance, ownedSkins, equippedSkin, playerName } = profile.data;
  view.updateProfile(
    { balance, owned: ownedSkins, equipped: equippedSkin, skins: SKINS },
    playerName,
  );
}

/** Sound, music and volume follow the saved settings, wherever they were changed. */
function applyAudio(): void {
  const { muted, music: musicOn, volume } = profile.data.settings;
  sfx.setMuted(muted);
  sfx.setVolume(volume);
  music.setEnabled(musicOn && !muted); // a muted game does not even schedule notes
  view.setAudio({ muted, music: musicOn, volume });
}

/** The music follows the screen and the level's biome; it never plays in a hidden tab. */
function applyMusic(): void {
  const biome = LEVELS[flow.levelIndex]?.biome ?? 'beach';
  music.setTrack(document.hidden ? undefined : musicFor(flow.screen, biome));
}

profile.onChange(() => {
  pushProfile();
  applyAudio();
});
pushProfile();
applyAudio();
// The points of a round and the campaign progress are saved the moment the round ends.
flow.onRoundEnd((outcome) => profile.recordRound(outcome.score, flow.progress));

flow.onChange(() => {
  applyMusic();
  hudKey = ''; // another level changes the goal and the level number, not just the score
  view.showScreen(flow.screen, flow.outcome, campaignView());
  refit();
});

bindPointer(view.canvas, () => presenter.rect(), {
  onMove: (position) => controls.pointerMoved(position),
  onPress: (position) => {
    void sfx.unlock();
    controls.pointerPressed(position);
  },
});
bindKeyboard(document, (command) => {
  if (command.kind === 'throw') void sfx.unlock();
  return controls.handle(command);
});

// Browsers only allow audio after a gesture: the first touch or key wakes it up (and the music).
for (const gesture of ['pointerdown', 'keydown'] as const) {
  document.addEventListener(gesture, () => void sfx.unlock(), { capture: true });
}
// Every button gives a small click.
document.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest('button:not(:disabled)') !== null) {
    sfx.play({ id: 'click', semitones: 0 });
  }
});

// A round must never keep running unseen: leaving the tab or window pauses it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flow.pause();
  applyMusic();
});
window.addEventListener('blur', () => flow.pause());
window.addEventListener('resize', refit);
view.onLayoutChange(refit);

view.setTranslator(translator);
view.showScreen(flow.screen, flow.outcome, campaignView());
applyMusic();
refit();

startGameLoop((dtMs) => {
  const session = flow.session;
  if (session === undefined) {
    scene.renderBackdrop(frame, LEVELS[flow.levelIndex]?.biome ?? 'beach');
  } else {
    session.advance(dtMs);
    if (flow.screen !== 'paused') effects.update(dtMs);
    const state = session.state;
    scene.render(frame, {
      state,
      effects,
      aim: controls.aimVisible ? controls.aim : undefined,
      slipperSlots: slotsForSkin(profile.data.equippedSkin),
      trail: trailForSkin(profile.data.equippedSkin),
    });
    const key = `${state.score}|${state.ammo}|${state.combo}`;
    if (key !== hudKey) {
      hudKey = key;
      view.updateHud(buildHud(state, flow.levelIndex + 1, translator));
    }
  }
  presenter.present();
});
